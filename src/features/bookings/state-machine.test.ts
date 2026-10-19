import { describe, expect, it } from "vitest";

import { bookingTransitions, canTransition, cancellationOutcome, nextStatuses, serviceRequestTransitions } from "./state-machine";
import { bookingStatuses, type BookingStatus } from "./types";

const actors = ["customer", "technician", "admin", "system"] as const;

describe("Get Help Now booking transitions", () => {
  it("follows the happy path with the right actor at each step", () => {
    const path: [BookingStatus, BookingStatus, (typeof actors)[number]][] = [
      ["technician_assigned", "visit_scheduled", "customer"],
      ["visit_scheduled", "en_route", "technician"],
      ["en_route", "inspecting", "technician"],
      ["inspecting", "awaiting_customer_approval", "technician"],
      ["awaiting_customer_approval", "quote_rejected", "customer"],
      ["quote_rejected", "awaiting_customer_approval", "technician"],
      ["awaiting_customer_approval", "confirmed", "customer"],
      ["confirmed", "work_in_progress", "technician"],
      ["work_in_progress", "completed", "technician"],
    ];
    for (const [from, to, actor] of path) {
      expect(canTransition(bookingTransitions, from, to, actor), `${from} → ${to} by ${actor}`).toBe(true);
      for (const other of actors.filter((a) => a !== actor && a !== "admin")) {
        expect(canTransition(bookingTransitions, from, to, other), `${from} → ${to} by ${other}`).toBe(false);
      }
    }
  });

  it("never lets work start before the customer approves a quotation", () => {
    for (const from of bookingStatuses.filter((s) => s !== "confirmed")) {
      for (const actor of actors) {
        expect(canTransition(bookingTransitions, from, "work_in_progress", actor), `${from} by ${actor}`).toBe(false);
      }
    }
    // Only the customer can reach "confirmed", and only from a pending quotation.
    const intoConfirmed = bookingTransitions.filter((t) => t.to === "confirmed");
    expect(intoConfirmed).toEqual([{ from: "awaiting_customer_approval", to: "confirmed", actors: ["customer"] }]);
  });

  it("has no way out of completed or cancelled", () => {
    for (const actor of actors) {
      expect(nextStatuses(bookingTransitions, "completed", actor)).toEqual([]);
      expect(nextStatuses(bookingTransitions, "cancelled", actor)).toEqual([]);
    }
  });

  it("defines who may cancel when", () => {
    const canCancel = (from: BookingStatus, actor: (typeof actors)[number]) =>
      canTransition(bookingTransitions, from, "cancelled", actor);
    // Customers: any time before work starts.
    for (const s of ["technician_assigned", "visit_scheduled", "en_route", "inspecting", "awaiting_customer_approval", "quote_rejected", "confirmed"] as const) {
      expect(canCancel(s, "customer"), s).toBe(true);
    }
    expect(canCancel("work_in_progress", "customer")).toBe(false);
    // Technicians: not while the customer is deciding, nor after approval.
    expect(canCancel("en_route", "technician")).toBe(true);
    expect(canCancel("quote_rejected", "technician")).toBe(true);
    expect(canCancel("awaiting_customer_approval", "technician")).toBe(false);
    expect(canCancel("confirmed", "technician")).toBe(false);
    expect(canCancel("work_in_progress", "technician")).toBe(false);
    // Admins: anything not finished. Nobody: finished jobs.
    expect(canCancel("work_in_progress", "admin")).toBe(true);
    expect(canCancel("completed", "admin")).toBe(false);
  });
});

describe("cancellationOutcome", () => {
  it("reopens the request only when the technician withdraws before arriving", () => {
    expect(cancellationOutcome("visit_scheduled", "technician", 0).reopensRequest).toBe(true);
    expect(cancellationOutcome("en_route", "technician", 0).reopensRequest).toBe(true);
    expect(cancellationOutcome("inspecting", "technician", 0).reopensRequest).toBe(false);
    expect(cancellationOutcome("visit_scheduled", "customer", 0).reopensRequest).toBe(false);
  });

  it("charges an agreed inspection fee only after the inspection", () => {
    expect(cancellationOutcome("en_route", "customer", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("inspecting", "customer", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("awaiting_customer_approval", "customer", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("inspecting", "technician", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("quote_rejected", "technician", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("confirmed", "admin", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("confirmed", "customer", 0).inspectionFeeDue).toBe(false);
  });
});

describe("service request transitions", () => {
  it("lets only technicians claim, and only the system expire, an open request", () => {
    expect(canTransition(serviceRequestTransitions, "open", "assigned", "technician")).toBe(true);
    expect(canTransition(serviceRequestTransitions, "open", "assigned", "customer")).toBe(false);
    expect(canTransition(serviceRequestTransitions, "open", "expired", "system")).toBe(true);
    expect(canTransition(serviceRequestTransitions, "open", "expired", "customer")).toBe(false);
    expect(canTransition(serviceRequestTransitions, "cancelled", "open", "technician")).toBe(false);
  });
});

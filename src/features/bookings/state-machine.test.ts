import { describe, expect, it } from "vitest";

import {
  bookingTransitions,
  canTransition,
  cancellationOutcome,
  nextStatuses,
  offerTransitions,
  quotationTransitions,
  serviceRequestTransitions,
} from "./state-machine";
import { bookingModes, bookingStatuses, type BookingMode, type BookingStatus } from "./types";

const actors = ["customer", "technician", "admin", "system"] as const;
type Actor = (typeof actors)[number];
type Step = [BookingStatus, BookingStatus, Actor | Actor[]];

/** Each step is allowed for its actors only (admins aside), in that mode. */
function expectPath(mode: BookingMode, path: Step[]) {
  for (const [from, to, allowed] of path) {
    const list = Array.isArray(allowed) ? allowed : [allowed];
    for (const actor of list) {
      expect(canTransition(bookingTransitions, from, to, actor, mode), `${mode}: ${from} → ${to} by ${actor}`).toBe(true);
    }
    for (const other of actors.filter((a) => !list.includes(a) && a !== "admin")) {
      expect(canTransition(bookingTransitions, from, to, other, mode), `${mode}: ${from} → ${to} by ${other}`).toBe(false);
    }
  }
}

const quoteAndWork: Step[] = [
  ["inspecting", "awaiting_customer_approval", "technician"],
  ["awaiting_customer_approval", "quote_rejected", ["customer", "system"]], // revision requested, or expired
  ["quote_rejected", "awaiting_customer_approval", "technician"],
  ["awaiting_customer_approval", "confirmed", "customer"],
  ["confirmed", "work_in_progress", "technician"],
  ["work_in_progress", "completed", "technician"],
];

describe("booking transitions by option", () => {
  it("Get Help Now: accept → confirm visit → travel → inspect → quote → approve → work", () => {
    expectPath("urgent", [
      ["technician_assigned", "visit_scheduled", "customer"],
      ["visit_scheduled", "en_route", "technician"],
      ["en_route", "inspecting", "technician"],
      ...quoteAndWork,
    ]);
  });

  it("Technician Visit: starts at the booked visit, then inspects and quotes", () => {
    expectPath("quote_visit", [
      ["visit_scheduled", "en_route", "technician"],
      ["en_route", "inspecting", "technician"],
      ...quoteAndWork,
    ]);
    // The visit was confirmed by selecting the offer; there's no separate confirmation step.
    expect(canTransition(bookingTransitions, "technician_assigned", "visit_scheduled", "customer", "quote_visit")).toBe(false);
  });

  it("Quote Online: starts confirmed; on site the technician works or sends a revised quotation", () => {
    expectPath("quote_online", [
      ["confirmed", "en_route", "technician"],
      ["en_route", "inspecting", "technician"],
      ["inspecting", "work_in_progress", "technician"],
      ["work_in_progress", "completed", "technician"],
    ]);
    expectPath("quote_online", [["inspecting", "awaiting_customer_approval", "technician"]]);
    // Visit modes can't skip from on-site inspection straight to paid work.
    expect(canTransition(bookingTransitions, "inspecting", "work_in_progress", "technician", "urgent")).toBe(false);
    expect(canTransition(bookingTransitions, "inspecting", "work_in_progress", "technician", "quote_visit")).toBe(false);
    expect(canTransition(bookingTransitions, "confirmed", "en_route", "technician", "urgent")).toBe(false);
  });

  it("pauses work for a mid-job price change until the customer approves it", () => {
    for (const mode of bookingModes) {
      expect(canTransition(bookingTransitions, "work_in_progress", "awaiting_customer_approval", "technician", mode)).toBe(true);
      expect(canTransition(bookingTransitions, "awaiting_customer_approval", "work_in_progress", "technician", mode)).toBe(false);
    }
  });

  it("never lets paid work start except after approval (or on site under an accepted online quote)", () => {
    for (const mode of bookingModes) {
      const allowedFrom = mode === "quote_online" ? ["confirmed", "inspecting"] : ["confirmed"];
      for (const from of bookingStatuses) {
        for (const actor of actors) {
          const expected = allowedFrom.includes(from) && actor === "technician";
          expect(canTransition(bookingTransitions, from, "work_in_progress", actor, mode), `${mode} ${from} by ${actor}`).toBe(expected);
        }
      }
    }
    // Only the customer can approve.
    expect(bookingTransitions.filter((t) => t.to === "confirmed").flatMap((t) => t.actors)).toEqual(["customer"]);
  });

  it("has no way out of completed or cancelled", () => {
    for (const mode of bookingModes) {
      for (const actor of actors) {
        expect(nextStatuses(bookingTransitions, "completed", actor, mode)).toEqual([]);
        expect(nextStatuses(bookingTransitions, "cancelled", actor, mode)).toEqual([]);
      }
    }
  });

  it("defines who may cancel when", () => {
    const canCancel = (from: BookingStatus, actor: Actor) => canTransition(bookingTransitions, from, "cancelled", actor, "urgent");
    for (const s of ["technician_assigned", "visit_scheduled", "en_route", "inspecting", "awaiting_customer_approval", "quote_rejected", "confirmed"] as const) {
      expect(canCancel(s, "customer"), s).toBe(true);
    }
    expect(canCancel("work_in_progress", "customer")).toBe(false);
    expect(canCancel("en_route", "technician")).toBe(true);
    expect(canCancel("quote_rejected", "technician")).toBe(true);
    expect(canCancel("awaiting_customer_approval", "technician")).toBe(false);
    expect(canCancel("confirmed", "technician")).toBe(false);
    expect(canCancel("work_in_progress", "technician")).toBe(false);
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

  it("charges an agreed visit fee only after the inspection", () => {
    expect(cancellationOutcome("en_route", "customer", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("inspecting", "customer", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("awaiting_customer_approval", "customer", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("inspecting", "technician", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("quote_rejected", "technician", 1500).inspectionFeeDue).toBe(true);
    expect(cancellationOutcome("confirmed", "admin", 1500).inspectionFeeDue).toBe(false);
    expect(cancellationOutcome("confirmed", "customer", 0).inspectionFeeDue).toBe(false);
  });
});

describe("request, offer and quotation transitions", () => {
  it("lets technicians claim urgent requests and customers choose quotes", () => {
    expect(canTransition(serviceRequestTransitions, "open", "assigned", "technician", "urgent")).toBe(true);
    expect(canTransition(serviceRequestTransitions, "open", "assigned", "customer", "urgent")).toBe(false);
    for (const mode of ["quote_visit", "quote_online"] as const) {
      expect(canTransition(serviceRequestTransitions, "open", "assigned", "customer", mode)).toBe(true);
      expect(canTransition(serviceRequestTransitions, "open", "assigned", "technician", mode)).toBe(false);
    }
    expect(canTransition(serviceRequestTransitions, "open", "expired", "system")).toBe(true);
    expect(canTransition(serviceRequestTransitions, "open", "expired", "customer")).toBe(false);
  });

  it("only lets the customer select an offer, and restores others if the winner withdraws", () => {
    expect(canTransition(offerTransitions, "pending", "selected", "customer")).toBe(true);
    expect(canTransition(offerTransitions, "pending", "selected", "technician")).toBe(false);
    expect(canTransition(offerTransitions, "not_selected", "pending", "system")).toBe(true);
    expect(canTransition(offerTransitions, "selected", "pending", "technician")).toBe(false);
  });

  it("never edits an accepted quotation: it can only be superseded by an approved revision", () => {
    expect(nextStatuses(quotationTransitions, "accepted", "customer")).toEqual(["superseded"]);
    for (const actor of ["technician", "admin", "system"] as const) {
      expect(nextStatuses(quotationTransitions, "accepted", actor)).toEqual([]);
    }
    for (const done of ["rejected", "revision_requested", "withdrawn", "superseded", "expired"] as const) {
      for (const actor of actors) expect(nextStatuses(quotationTransitions, done, actor)).toEqual([]);
    }
  });
});

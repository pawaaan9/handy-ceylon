import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";

import { submitQuotationSchema } from "@/features/bookings/schemas";
import {
  acceptUrgentRequest,
  cancelBooking,
  countAvailableTechnicians,
  declineRequest,
  decideQuotation,
  getBookingView,
  listAvailableRequests,
  runBookingStep,
  submitQuotation,
  type Actor,
} from "@/features/bookings/server/repository";
import { createServiceRequestSchema } from "@/features/requests/schemas";
import {
  cancelServiceRequest,
  createServiceRequest,
  getCustomerRequest,
} from "@/features/requests/server/repository";
import { adminDb } from "@/lib/firebase/admin";

import { createCustomerWithAddress, resetEmulators, seedCatalogue, seedTechnician } from "./helpers";

beforeEach(async () => {
  await resetEmulators();
  await seedCatalogue();
});

let keyCounter = 0;
const newKey = () => `test-key-${Date.now()}-${++keyCounter}-abcdef`;

async function urgentRequest(customer: { uid: string; addressId: string }, overrides: Record<string, unknown> = {}) {
  const { id } = await createServiceRequest(
    customer.uid,
    createServiceRequestSchema.parse({
      submissionKey: newKey(),
      mode: "urgent",
      categoryId: "plumbing",
      serviceId: "leak-repair",
      addressId: customer.addressId,
      title: "Burst pipe under sink",
      description: "Water is spraying from the pipe under the kitchen sink and the floor is flooding.",
      urgency: "emergency",
      timing: "asap",
      preferredDate: "",
      preferredTimeSlot: "",
      accessInstructions: "Side gate is open",
      measurements: "",
      attachments: [],
      ...overrides,
    }),
  );
  return id;
}

const accept = (techUid: string, requestId: string, fee = 1500) =>
  acceptUrgentRequest(techUid, { requestId, inspectionFeeLkr: fee, etaMinutes: 45, message: "On standby" });

const quote = (bookingId: string, labour = 3000, key = newKey()) =>
  submitQuotationSchema.parse({
    bookingId,
    submissionKey: key,
    inspectionFindings: "Corroded compression fitting on the cold supply line; needs replacing.",
    lineItems: [
      { kind: "labour", description: "Replace fitting", quantity: 1, unitPriceLkr: labour },
      { kind: "materials", description: "Brass fitting", quantity: 2, unitPriceLkr: 750 },
      { kind: "additional", description: "Emergency call-out", quantity: 1, unitPriceLkr: 500 },
    ],
    estimatedDurationHours: "2",
    notes: "",
  });

const requestDoc = async (id: string) => (await adminDb().doc(`serviceRequests/${id}`).get()).data()!;
const bookingDoc = async (id: string) => (await adminDb().doc(`bookings/${id}`).get()).data()!;

async function setup() {
  const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
  await seedTechnician("tom");
  const requestId = await urgentRequest(alice);
  const customer: Actor = { uid: alice.uid, role: "customer" };
  const tech: Actor = { uid: "tom", role: "technician" };
  return { alice, customer, tech, requestId };
}

/** Accept → confirm → travel → arrive: ready for a quotation. */
async function toInspecting() {
  const ctx = await setup();
  const { bookingId } = await accept("tom", ctx.requestId);
  await runBookingStep(ctx.customer, bookingId, "confirm_visit");
  await runBookingStep(ctx.tech, bookingId, "start_travel");
  await runBookingStep(ctx.tech, bookingId, "arrive");
  return { ...ctx, bookingId };
}

describe("Get Help Now workflow", () => {
  it("runs from acceptance through a revised quotation to a completed job", async () => {
    const { customer, tech, requestId } = await setup();
    const { bookingId, created } = await accept("tom", requestId, 1000);
    expect(created).toBe(true);
    expect(await requestDoc(requestId)).toMatchObject({
      status: "assigned",
      selectedTechnicianId: "tom",
      bookingId,
      bookingStatus: "technician_assigned",
    });

    // The customer sees the verified technician and the fee before confirming.
    const before = (await getBookingView(customer, bookingId))!;
    expect(before.status).toBe("technician_assigned");
    expect(before.inspectionFeeLkr).toBe(1000);
    expect(before.technician).toMatchObject({ uid: "tom", verified: true, yearsOfExperience: 8 });
    expect(before.allowed.steps).toEqual(["confirm_visit"]);

    await runBookingStep(customer, bookingId, "confirm_visit");
    await runBookingStep(tech, bookingId, "start_travel");
    await runBookingStep(tech, bookingId, "arrive");

    const first = await submitQuotation("tom", quote(bookingId, 4000));
    expect((await getBookingView(customer, bookingId))!.allowed.decideQuotationId).toBe(first.id);
    await decideQuotation(customer.uid, { quotationId: first.id, decision: "request_revision", reason: "Labour seems high" });
    expect((await bookingDoc(bookingId)).status).toBe("quote_rejected");

    const second = await submitQuotation("tom", quote(bookingId, 2500));
    await decideQuotation(customer.uid, { quotationId: second.id, decision: "approve", reason: null });

    const confirmed = (await getBookingView(customer, bookingId))!;
    expect(confirmed.status).toBe("confirmed");
    // 2500 labour + 1500 materials + 500 additional + 1000 inspection, all server-computed.
    expect(confirmed.agreedTotalLkr).toBe(5500);
    expect(confirmed.quotations.map((q) => [q.version, q.status, q.totalLkr])).toEqual([
      [2, "accepted", 5500],
      [1, "revision_requested", 7000],
    ]);
    expect(confirmed.quotations[1].decisionReason).toBe("Labour seems high");

    await runBookingStep(tech, bookingId, "start_work");
    await runBookingStep(tech, bookingId, "complete_work");

    const done = (await getBookingView(tech, bookingId))!;
    expect(done.status).toBe("completed");
    expect(done.history.map((e) => e.to)).toEqual([
      "technician_assigned",
      "visit_scheduled",
      "en_route",
      "inspecting",
      "awaiting_customer_approval",
      "quote_rejected",
      "awaiting_customer_approval",
      "confirmed",
      "work_in_progress",
      "completed",
    ]);
    const events = await adminDb().collection(`bookings/${bookingId}/statusHistory`).get();
    for (const e of events.docs) {
      expect([customer.uid, "tom"]).toContain(e.get("actorId"));
      expect(e.get("at")).toBeInstanceOf(Timestamp);
    }
    expect((await requestDoc(requestId)).bookingStatus).toBe("completed");
    expect((await adminDb().doc("technicians/tom").get()).get("completedJobs")).toBe(1);
  });

  it("refuses to start work until the customer approves the quotation", async () => {
    const { tech, customer, bookingId } = await toInspecting();
    await expect(runBookingStep(tech, bookingId, "start_work")).rejects.toThrow(/isn't available/);

    const { id } = await submitQuotation("tom", quote(bookingId));
    await expect(runBookingStep(tech, bookingId, "start_work")).rejects.toThrow(/isn't available/);

    await decideQuotation(customer.uid, { quotationId: id, decision: "request_revision", reason: "Too expensive" });
    await expect(runBookingStep(tech, bookingId, "start_work")).rejects.toThrow(/isn't available/);
    expect((await bookingDoc(bookingId)).status).toBe("quote_rejected");
  });

  it("limits quotation revisions", async () => {
    const { customer, bookingId } = await toInspecting();
    for (let i = 0; i < 3; i++) {
      const { id } = await submitQuotation("tom", quote(bookingId, 3000 - i * 100));
      await decideQuotation(customer.uid, { quotationId: id, decision: "request_revision", reason: "Still too much" });
    }
    await expect(submitQuotation("tom", quote(bookingId, 1000))).rejects.toThrow(/3 quotations/);
  });
});

describe("concurrency and retries", () => {
  it("gives the job to exactly one of several technicians accepting at once", async () => {
    const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
    const techs = ["t1", "t2", "t3", "t4", "t5"];
    await Promise.all(techs.map((t) => seedTechnician(t)));
    const requestId = await urgentRequest(alice);

    const results = await Promise.allSettled(techs.map((t) => accept(t, requestId)));
    const winners = results.filter((r) => r.status === "fulfilled");
    expect(winners.length).toBe(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect(String((r as PromiseRejectedResult).reason)).toMatch(/already accepted/);
    }

    const request = await requestDoc(requestId);
    const winnerBooking = (winners[0] as PromiseFulfilledResult<{ bookingId: string }>).value.bookingId;
    expect(request.bookingId).toBe(winnerBooking);
    const bookings = await adminDb().collection("bookings").where("requestId", "==", requestId).get();
    expect(bookings.size).toBe(1);
    expect(bookings.docs[0].get("technicianId")).toBe(request.selectedTechnicianId);
  });

  it("returns the same booking when the winner's accept is retried", async () => {
    const { requestId } = await setup();
    const first = await accept("tom", requestId);
    const retry = await accept("tom", requestId);
    expect(retry).toEqual({ bookingId: first.bookingId, created: false });
  });

  it("settles a customer cancelling while a technician accepts", async () => {
    const { alice, requestId } = await setup();
    const [cancel, acceptance] = await Promise.allSettled([
      cancelServiceRequest(alice.uid, { requestId, reason: "no_longer_needed", note: null }),
      accept("tom", requestId),
    ]);
    const request = await requestDoc(requestId);
    // Exactly one of them wins, and the request reflects that one.
    expect([cancel.status, acceptance.status].filter((s) => s === "fulfilled").length).toBe(1);
    expect(request.status).toBe(cancel.status === "fulfilled" ? "cancelled" : "assigned");
    const bookings = await adminDb().collection("bookings").where("requestId", "==", requestId).get();
    expect(bookings.size).toBe(acceptance.status === "fulfilled" ? 1 : 0);
  });

  it("treats retried steps, quotations and decisions as no-ops", async () => {
    const ctx = await setup();
    const fresh = await accept("tom", ctx.requestId);
    await runBookingStep(ctx.customer, fresh.bookingId, "confirm_visit");
    await runBookingStep(ctx.customer, fresh.bookingId, "confirm_visit");
    const confirms = await adminDb().collection(`bookings/${fresh.bookingId}/statusHistory`).where("to", "==", "visit_scheduled").get();
    expect(confirms.size).toBe(1);
    await runBookingStep(ctx.tech, fresh.bookingId, "start_travel");
    await runBookingStep(ctx.tech, fresh.bookingId, "arrive");
    const { customer } = ctx;
    const bookingId = fresh.bookingId;

    const key = newKey();
    const a = await submitQuotation("tom", quote(bookingId, 3000, key));
    const b = await submitQuotation("tom", quote(bookingId, 3000, key));
    expect(b).toEqual({ id: a.id, created: false });
    expect((await bookingDoc(bookingId)).quotationCount).toBe(1);

    await decideQuotation(customer.uid, { quotationId: a.id, decision: "approve", reason: null });
    await decideQuotation(customer.uid, { quotationId: a.id, decision: "approve", reason: null });
    const tech: Actor = { uid: "tom", role: "technician" };
    await runBookingStep(tech, bookingId, "start_work");
    await runBookingStep(tech, bookingId, "start_work");
    const history = await adminDb().collection(`bookings/${bookingId}/statusHistory`).get();
    expect(history.docs.filter((d) => d.get("to") === "work_in_progress").length).toBe(1);
  });
});

describe("eligibility and availability", () => {
  it("only lets online, approved technicians covering the category and district accept", async () => {
    const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
    await seedTechnician("offline", { availability: "offline" });
    await seedTechnician("suspended", { verificationStatus: "suspended" });
    await seedTechnician("galle", { serviceDistricts: ["Galle"] });
    await seedTechnician("sparky", { categoryIds: ["electrical"] });
    await seedTechnician(alice.uid);
    const requestId = await urgentRequest(alice);

    await expect(accept("offline", requestId)).rejects.toThrow(/Go online/);
    await expect(accept("suspended", requestId)).rejects.toThrow(/isn't active/);
    await expect(accept("galle", requestId)).rejects.toThrow(/districts/);
    await expect(accept("sparky", requestId)).rejects.toThrow(/categories/);
    await expect(accept(alice.uid, requestId)).rejects.toThrow(/own request/);
    await expect(accept("nobody", requestId)).rejects.toThrow(/profile could not be found/);
    expect((await requestDoc(requestId)).status).toBe("open");
  });

  it("refuses quote requests through the urgent flow", async () => {
    const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
    await seedTechnician("tom");
    const requestId = await urgentRequest(alice, {
      mode: "quote_visit",
      urgency: "normal",
      timing: "flexible",
    });
    await expect(accept("tom", requestId)).rejects.toThrow(/Get Help Now/);
  });

  it("counts only technicians who are actually online for the category and district", async () => {
    await seedTechnician("a");
    await seedTechnician("b", { availability: "offline" });
    await seedTechnician("c", { serviceDistricts: ["Galle"] });
    await seedTechnician("d", { verificationStatus: "suspended" });
    await seedTechnician("e", { accountStatus: "disabled" });
    await seedTechnician("f", { serviceDistricts: ["Galle", "Kandy"] });
    expect(await countAvailableTechnicians("plumbing", "Kandy")).toBe(2);
    expect(await countAvailableTechnicians("electrical", "Kandy")).toBe(0);
  });

  it("lists eligible requests and hides declined ones", async () => {
    const { requestId } = await setup();
    const listed = await listAvailableRequests("tom");
    expect(listed.technician).toMatchObject({ availability: "online", canAcceptUrgent: true, canQuote: true });
    expect(listed.requests.map((r) => r.id)).toEqual([requestId]);
    // Summaries never carry the private address.
    expect(listed.requests[0]).not.toHaveProperty("address");

    await declineRequest("tom", requestId);
    await declineRequest("tom", requestId);
    expect((await listAvailableRequests("tom")).requests).toEqual([]);
    await expect(accept("tom", requestId)).rejects.toThrow(/already passed/);

    await seedTechnician("galle", { serviceDistricts: ["Galle"] });
    expect((await listAvailableRequests("galle")).requests).toEqual([]);
  });
});

describe("expiry", () => {
  it("expires an overdue request instead of assigning it", async () => {
    const { alice, requestId } = await setup();
    await adminDb().doc(`serviceRequests/${requestId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });

    expect((await listAvailableRequests("tom")).requests).toEqual([]);
    await expect(accept("tom", requestId)).rejects.toThrow(/expired/);
    const request = await requestDoc(requestId);
    expect(request.status).toBe("expired");
    expect(request.selectedTechnicianId).toBeNull();

    const view = (await getCustomerRequest(alice.uid, requestId))!;
    expect(view.history.map((e) => [e.to, e.actorRole])).toEqual([
      ["open", "customer"],
      ["expired", "system"],
    ]);
  });

  it("expires an overdue request when its customer opens it", async () => {
    const { alice, requestId } = await setup();
    await adminDb().doc(`serviceRequests/${requestId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    expect((await getCustomerRequest(alice.uid, requestId))!.status).toBe("expired");
    expect((await requestDoc(requestId)).status).toBe("expired");
  });
});

describe("cancellation", () => {
  it("reopens the request when the technician withdraws before arriving", async () => {
    const { customer, tech, requestId } = await setup();
    await seedTechnician("tina");
    const { bookingId } = await accept("tom", requestId);
    await runBookingStep(customer, bookingId, "confirm_visit");

    const outcome = await cancelBooking(tech, { bookingId, reason: "Van broke down" });
    expect(outcome).toEqual({ reopensRequest: true, inspectionFeeDue: false });
    expect(await requestDoc(requestId)).toMatchObject({ status: "open", selectedTechnicianId: null, bookingId: null });
    expect((await adminDb().doc(`serviceRequests/${requestId}/offers/tom`).get()).get("status")).toBe("withdrawn");

    // The same technician can't grab it again, but another one can.
    await expect(accept("tom", requestId)).rejects.toThrow(/already passed/);
    const second = await accept("tina", requestId);
    expect(second.bookingId).not.toBe(bookingId);
    expect((await bookingDoc(bookingId)).status).toBe("cancelled");
  });

  it("expires the request if the technician withdraws after its deadline", async () => {
    const { tech, requestId } = await setup();
    const { bookingId } = await accept("tom", requestId);
    await adminDb().doc(`serviceRequests/${requestId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await cancelBooking(tech, { bookingId, reason: "Can't make it" });
    expect((await requestDoc(requestId)).status).toBe("expired");
  });

  it("records an inspection fee as due when the customer cancels after inspection", async () => {
    const { customer, requestId, bookingId } = await toInspecting();
    const outcome = await cancelBooking(customer, { bookingId, reason: "Decided to wait" });
    expect(outcome).toEqual({ reopensRequest: false, inspectionFeeDue: true });
    expect((await bookingDoc(bookingId)).cancellation).toMatchObject({
      by: "customer",
      actorId: customer.uid,
      fromStatus: "inspecting",
      inspectionFeeDue: true,
    });
    expect(await requestDoc(requestId)).toMatchObject({ status: "cancelled", bookingStatus: "cancelled" });
  });

  it("enforces who may cancel when", async () => {
    const { customer, tech, bookingId } = await toInspecting();
    const { id } = await submitQuotation("tom", quote(bookingId));
    await expect(cancelBooking(tech, { bookingId, reason: "Changed my mind" })).rejects.toThrow(/can't cancel/);

    await decideQuotation(customer.uid, { quotationId: id, decision: "approve", reason: null });
    await expect(cancelBooking(tech, { bookingId, reason: "Changed my mind" })).rejects.toThrow(/can't cancel/);

    await runBookingStep(tech, bookingId, "start_work");
    await expect(cancelBooking(customer, { bookingId, reason: "Too slow" })).rejects.toThrow(/can't cancel/);
    // Admins can still step in.
    await cancelBooking({ uid: "admin1", role: "admin" }, { bookingId, reason: "Dispute resolved by support" });
    expect((await bookingDoc(bookingId)).status).toBe("cancelled");
  });

  it("withdraws a pending quotation when the customer cancels instead of deciding", async () => {
    const { customer, bookingId } = await toInspecting();
    const { id } = await submitQuotation("tom", quote(bookingId));
    await cancelBooking(customer, { bookingId, reason: "Found it cheaper" });
    expect((await adminDb().doc(`quotations/${id}`).get()).get("status")).toBe("withdrawn");
  });
});

describe("ownership", () => {
  it("keeps other customers and technicians out of the booking", async () => {
    const { customer, bookingId } = await toInspecting();
    const bob = await createCustomerWithAddress("bob@example.com", "0779999999");
    await seedTechnician("tina");
    const otherCustomer: Actor = { uid: bob.uid, role: "customer" };
    const otherTech: Actor = { uid: "tina", role: "technician" };

    expect(await getBookingView(otherCustomer, bookingId)).toBeNull();
    expect(await getBookingView(otherTech, bookingId)).toBeNull();
    await expect(runBookingStep(otherTech, bookingId, "start_work")).rejects.toThrow(/could not be found/);
    await expect(submitQuotation("tina", quote(bookingId))).rejects.toThrow(/could not be found/);
    await expect(cancelBooking(otherCustomer, { bookingId, reason: "Not mine" })).rejects.toThrow(/could not be found/);

    const { id } = await submitQuotation("tom", quote(bookingId));
    await expect(
      decideQuotation(bob.uid, { quotationId: id, decision: "approve", reason: null }),
    ).rejects.toThrow(/could not be found/);
    // The customer can't do the technician's steps, and vice versa.
    await expect(runBookingStep(customer, bookingId, "start_work")).rejects.toThrow(/other party/);
    expect((await bookingDoc(bookingId)).status).toBe("awaiting_customer_approval");
  });

  it("shows the assigned technician the address, but nobody else", async () => {
    const { requestId } = await setup();
    await seedTechnician("tina");
    const { getRequestForViewer } = await import("@/features/requests/server/repository");
    expect(await getRequestForViewer({ uid: "tom", role: "technician" }, requestId)).toBeNull();
    await accept("tom", requestId);
    const view = await getRequestForViewer({ uid: "tom", role: "technician" }, requestId);
    expect(view?.address).toMatchObject({ street: "Temple Road" });
    expect(view?.accessInstructions).toBe("Side gate is open");
    expect(await getRequestForViewer({ uid: "tina", role: "technician" }, requestId)).toBeNull();
  });
});

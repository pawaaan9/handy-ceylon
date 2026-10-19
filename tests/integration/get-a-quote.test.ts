import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";

import { submitQuotationSchema, submitRemoteQuotationSchema } from "@/features/bookings/schemas";
import {
  cancelBooking,
  decideQuotation,
  getBookingView,
  listAvailableRequests,
  runBookingStep,
  submitQuotation,
  type Actor,
} from "@/features/bookings/server/repository";
import {
  getTechnicianRequestView,
  listRemoteQuotations,
  listVisitOffers,
  selectRemoteQuotation,
  selectVisitOffer,
  submitRemoteQuotation,
  submitVisitOffer,
  withdrawRemoteQuotation,
  withdrawVisitOffer,
} from "@/features/bookings/server/quotes";
import { listMessages, sendMessage } from "@/features/messages/server/repository";
import { addDays, colomboToday, createServiceRequestSchema } from "@/features/requests/schemas";
import { createServiceRequest } from "@/features/requests/server/repository";
import { adminDb } from "@/lib/firebase/admin";

import { createCustomerWithAddress, resetEmulators, seedCatalogue, seedTechnician, uploadAs } from "./helpers";

beforeEach(async () => {
  await resetEmulators();
  await seedCatalogue();
});

let n = 0;
const key = () => `quote-test-${Date.now()}-${++n}-abcdef`;
const day = (d: number) => addDays(colomboToday(), d);
const doc = async (path: string) => (await adminDb().doc(path).get()).data()!;

async function quoteRequest(customer: { uid: string; addressId: string }, mode: "quote_visit" | "quote_online") {
  const submissionKey = key();
  const attachments = [];
  if (mode === "quote_online") {
    const path = `requestMedia/${customer.uid}/${submissionKey}/1-wall.jpg`;
    await uploadAs(path, "image/jpeg");
    attachments.push({ storagePath: path, contentType: "image/jpeg", sizeBytes: 4, name: "wall.jpg" });
  }
  const { id } = await createServiceRequest(
    customer.uid,
    createServiceRequestSchema.parse({
      submissionKey,
      mode,
      categoryId: "plumbing",
      serviceId: "leak-repair",
      addressId: customer.addressId,
      title: "Re-tile bathroom floor",
      description: "Bathroom floor tiles are cracked and loose near the shower; replace about 4 square metres.",
      urgency: "normal",
      timing: "scheduled",
      preferredDate: day(5),
      preferredTimeSlot: "morning",
      accessInstructions: "Gate code 1234",
      measurements: mode === "quote_online" ? "2 m × 2 m floor" : "",
      siteConditions: "Second floor, no lift",
      attachments,
    }),
  );
  return id;
}

async function setup(mode: "quote_visit" | "quote_online") {
  const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
  await seedTechnician("tom", { ratingAverage: 4.6, ratingCount: 12 });
  await seedTechnician("tina", { availability: "offline" }); // quoting doesn't need "online"
  const requestId = await quoteRequest(alice, mode);
  return {
    alice,
    requestId,
    customer: { uid: alice.uid, role: "customer" } as Actor,
    tom: { uid: "tom", role: "technician" } as Actor,
    tina: { uid: "tina", role: "technician" } as Actor,
  };
}

const offer = (requestId: string, fee: number, days: number[] = [2, 3]) => ({
  requestId,
  inspectionFeeLkr: fee,
  proposedVisits: days.map((d, i) => ({ date: day(d), timeSlot: i % 2 ? ("afternoon" as const) : ("morning" as const) })),
  message: null,
});

const remote = (requestId: string, labour: number, k = key()) =>
  submitRemoteQuotationSchema.parse({
    requestId,
    submissionKey: k,
    lineItems: [
      { kind: "labour", description: "Lay tiles", quantity: 1, unitPriceLkr: labour },
      { kind: "materials", description: "Tiles", quantity: 4, unitPriceLkr: 3000 },
    ],
    estimatedDurationHours: 12,
    exclusions: "Skirting",
    assumptions: "Sub-floor is sound",
    notes: "",
    validForDays: 7,
  });

const onSite = (bookingId: string, labour: number, revisionReason = "") =>
  submitQuotationSchema.parse({
    bookingId,
    submissionKey: key(),
    inspectionFindings: "Sub-floor screed has crumbled under the shower and must be relaid first.",
    lineItems: [
      { kind: "labour", description: "Lay tiles", quantity: 1, unitPriceLkr: labour },
      { kind: "materials", description: "Tiles", quantity: 4, unitPriceLkr: 3000 },
      { kind: "additional", description: "Relay screed", quantity: 1, unitPriceLkr: 6000 },
    ],
    estimatedDurationHours: "",
    notes: "",
    revisionReason,
  });

describe("Technician Visit", () => {
  it("compares offers, books a visit, then inspects, quotes and completes", async () => {
    const { customer, tom, requestId, alice } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    await submitVisitOffer("tina", offer(requestId, 1000, [4]));

    const offers = (await listVisitOffers(alice.uid, requestId))!;
    expect(offers.map((o) => [o.technicianId, o.inspectionFeeLkr])).toEqual([
      ["tina", 1000],
      ["tom", 1500],
    ]);
    expect(offers[1].technician).toMatchObject({ verified: true, ratingAverage: 4.6, phoneNumber: null });

    const { bookingId } = await selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 1 });
    const booking = (await getBookingView(customer, bookingId))!;
    expect(booking).toMatchObject({
      mode: "quote_visit",
      status: "visit_scheduled",
      inspectionFeeLkr: 1500,
      scheduledVisit: { date: day(3), timeSlot: "afternoon" },
      payment: { status: "awaiting_completion", visitFeeLkr: 1500, repairChargesLkr: 0, totalDueLkr: 1500 },
    });
    expect((await doc(`serviceRequests/${requestId}/offers/tina`)).status).toBe("not_selected");
    expect((await doc(`serviceRequests/${requestId}/offers/tom`)).chosenVisit).toEqual({ date: day(3), timeSlot: "afternoon" });

    await runBookingStep(tom, bookingId, "start_travel");
    await runBookingStep(tom, bookingId, "arrive");
    await expect(runBookingStep(tom, bookingId, "start_work")).rejects.toThrow(/isn't available/);
    const first = await submitQuotation("tom", onSite(bookingId, 10000));
    await decideQuotation(alice.uid, { quotationId: first.id, decision: "request_revision", reason: "Labour too high" });
    const second = await submitQuotation("tom", onSite(bookingId, 8000));
    await decideQuotation(alice.uid, { quotationId: second.id, decision: "approve", reason: null });

    const confirmed = (await getBookingView(customer, bookingId))!;
    // 8000 labour + 12000 materials + 6000 screed = 26000 repairs, + 1500 visit fee.
    expect(confirmed.agreedTotalLkr).toBe(27500);
    expect(confirmed.payment).toMatchObject({ visitFeeLkr: 1500, repairChargesLkr: 26000, totalDueLkr: 27500 });
    await runBookingStep(tom, bookingId, "start_work");
    await runBookingStep(tom, bookingId, "complete_work");
    expect((await doc(`payments/${bookingId}`)).status).toBe("due");
  });

  it("lets exactly one of two simultaneous selections win", async () => {
    const { alice, requestId } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    await submitVisitOffer("tina", offer(requestId, 1000));
    const results = await Promise.allSettled([
      selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 }),
      selectVisitOffer(alice.uid, { requestId, technicianId: "tina", visitIndex: 0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const bookings = await adminDb().collection("bookings").where("requestId", "==", requestId).get();
    expect(bookings.size).toBe(1);
    const statuses = (await adminDb().collection(`serviceRequests/${requestId}/offers`).get()).docs.map((d) => d.get("status")).sort();
    expect(statuses).toEqual(["not_selected", "selected"]);
  });

  it("settles a selection racing the technician's withdrawal", async () => {
    const { alice, requestId } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    const [select, withdraw] = await Promise.allSettled([
      selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 }),
      withdrawVisitOffer("tom", requestId),
    ]);
    expect([select.status, withdraw.status].filter((s) => s === "fulfilled").length).toBe(1);
    const status = (await doc(`serviceRequests/${requestId}/offers/tom`)).status;
    expect(status).toBe(select.status === "fulfilled" ? "selected" : "withdrawn");
  });

  it("returns the same booking when a selection is retried", async () => {
    const { alice, requestId } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    const a = await selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 });
    const b = await selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 });
    expect(b).toEqual({ bookingId: a.bookingId, created: false });
  });

  it("only takes offers from eligible technicians on open visit requests", async () => {
    const { requestId, alice } = await setup("quote_visit");
    await seedTechnician("galle", { serviceDistricts: ["Galle"] });
    await seedTechnician("suspended", { verificationStatus: "suspended" });
    await expect(submitVisitOffer("galle", offer(requestId, 1000))).rejects.toThrow(/districts/);
    await expect(submitVisitOffer("suspended", offer(requestId, 1000))).rejects.toThrow(/isn't active/);
    await expect(submitVisitOffer("nobody", offer(requestId, 1000))).rejects.toThrow(/profile could not be found/);

    const online = await quoteRequest(alice, "quote_online");
    await expect(submitVisitOffer("tom", offer(online, 1000))).rejects.toThrow(/isn't a Technician Visit/);

    // Updating a pending offer is fine; re-offering after withdrawing is not.
    await submitVisitOffer("tom", offer(requestId, 1500));
    await submitVisitOffer("tom", offer(requestId, 1200));
    expect((await doc(`serviceRequests/${requestId}/offers/tom`)).inspectionFeeLkr).toBe(1200);
    await withdrawVisitOffer("tom", requestId);
    await expect(submitVisitOffer("tom", offer(requestId, 1000))).rejects.toThrow(/already passed/);
  });

  it("keeps offers private to the request's customer", async () => {
    const { requestId } = await setup("quote_visit");
    const bob = await createCustomerWithAddress("bob@example.com", "0779999999");
    await submitVisitOffer("tom", offer(requestId, 1500));
    expect(await listVisitOffers(bob.uid, requestId)).toBeNull();
    await expect(selectVisitOffer(bob.uid, { requestId, technicianId: "tom", visitIndex: 0 })).rejects.toThrow(/could not be found/);
  });

  it("closes the job with the visit fee due when the customer rejects the final quotation", async () => {
    const { alice, tom, requestId } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    const { bookingId } = await selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 });
    await runBookingStep(tom, bookingId, "start_travel");
    await runBookingStep(tom, bookingId, "arrive");
    const { id } = await submitQuotation("tom", onSite(bookingId, 9000));
    await decideQuotation(alice.uid, { quotationId: id, decision: "reject", reason: "Too expensive for now" });

    expect(await doc(`bookings/${bookingId}`)).toMatchObject({ status: "cancelled", cancellation: { inspectionFeeDue: true } });
    expect(await doc(`quotations/${id}`)).toMatchObject({ status: "rejected", decisionReason: "Too expensive for now" });
    expect(await doc(`payments/${bookingId}`)).toMatchObject({ status: "due", totalDueLkr: 1500, repairChargesLkr: 0 });
    expect((await doc(`serviceRequests/${requestId}`)).status).toBe("cancelled");
  });

  it("reopens the request with the other offers when the chosen technician withdraws", async () => {
    const { alice, tom, requestId } = await setup("quote_visit");
    await submitVisitOffer("tom", offer(requestId, 1500));
    await submitVisitOffer("tina", offer(requestId, 1000));
    const { bookingId } = await selectVisitOffer(alice.uid, { requestId, technicianId: "tom", visitIndex: 0 });

    await cancelBooking(tom, { bookingId, reason: "Family emergency" });
    expect((await doc(`serviceRequests/${requestId}`)).status).toBe("open");
    expect((await doc(`serviceRequests/${requestId}/offers/tina`)).status).toBe("pending");
    expect((await doc(`serviceRequests/${requestId}/offers/tom`)).status).toBe("withdrawn");
    expect((await doc(`payments/${bookingId}`)).status).toBe("void");

    const second = await selectVisitOffer(alice.uid, { requestId, technicianId: "tina", visitIndex: 0 });
    expect(second.bookingId).not.toBe(bookingId);
  });
});

describe("Quote Online", () => {
  it("compares sealed quotations and confirms the selected one as a booking", async () => {
    const { alice, customer, requestId } = await setup("quote_online");
    await submitRemoteQuotation("tom", remote(requestId, 15000));
    const tinaV1 = await submitRemoteQuotation("tina", remote(requestId, 14000));
    const tinaV2 = await submitRemoteQuotation("tina", remote(requestId, 12000));
    expect((await doc(`quotations/${tinaV1.id}`)).status).toBe("superseded");

    const quotes = (await listRemoteQuotations(alice.uid, requestId))!;
    expect(quotes.map((q) => [q.technicianId, q.totalLkr, q.version])).toEqual([
      ["tina", 24000, 2],
      ["tom", 27000, 1],
    ]);
    expect(quotes[0]).toMatchObject({ estimatedDurationHours: 12, exclusions: "Skirting", assumptions: "Sub-floor is sound", inspectionFeeLkr: 0 });

    const { bookingId } = await selectRemoteQuotation(alice.uid, tinaV2.id);
    const booking = (await getBookingView(customer, bookingId))!;
    expect(booking).toMatchObject({
      mode: "quote_online",
      status: "confirmed",
      agreedTotalLkr: 24000,
      acceptedQuotationId: tinaV2.id,
      payment: { status: "awaiting_completion", visitFeeLkr: 0, repairChargesLkr: 24000, totalDueLkr: 24000 },
    });
    expect(await doc(`quotations/${tinaV2.id}`)).toMatchObject({ status: "accepted", bookingId });
    const tom = (await adminDb().collection("quotations").where("technicianId", "==", "tom").get()).docs[0];
    expect(tom.get("status")).toBe("not_selected");
    expect(await doc(`serviceRequests/${requestId}`)).toMatchObject({ status: "assigned", selectedTechnicianId: "tina", acceptedQuotationId: tinaV2.id });
  });

  it("requires a reasoned, itemized revision and fresh approval for a price change on site", async () => {
    const { alice, customer, tina, requestId } = await setup("quote_online");
    const original = await submitRemoteQuotation("tina", remote(requestId, 12000));
    const { bookingId } = await selectRemoteQuotation(alice.uid, original.id);
    await runBookingStep(tina, bookingId, "start_travel");
    await runBookingStep(tina, bookingId, "arrive");

    await expect(submitQuotation("tina", onSite(bookingId, 12000))).rejects.toThrow(/Explain why/);
    const revised = await submitQuotation("tina", onSite(bookingId, 12000, "Screed under the tiles has failed"));
    const pending = (await getBookingView(customer, bookingId))!;
    expect(pending.status).toBe("awaiting_customer_approval");
    const rev = pending.quotations.find((q) => q.id === revised.id)!;
    expect(rev).toMatchObject({ revisionOfQuotationId: original.id, revisionReason: "Screed under the tiles has failed" });
    expect(rev.differences).toMatchObject({
      added: [expect.objectContaining({ description: "Relay screed", amountLkr: 6000 })],
      removed: [],
      changed: [],
      totalChangeLkr: 6000,
    });
    // No extra paid work until approved.
    await expect(runBookingStep(tina, bookingId, "start_work")).rejects.toThrow(/isn't available/);

    await decideQuotation(alice.uid, { quotationId: revised.id, decision: "approve", reason: null });
    const after = (await getBookingView(customer, bookingId))!;
    expect(after).toMatchObject({ status: "confirmed", agreedTotalLkr: 30000, acceptedQuotationId: revised.id });
    expect(after.payment).toMatchObject({ repairChargesLkr: 30000, totalDueLkr: 30000 });
    // The original stays on record, superseded but never edited.
    const old = await doc(`quotations/${original.id}`);
    expect(old).toMatchObject({ status: "superseded", totalLkr: 24000 });
    expect(old.acceptedAt).toBeInstanceOf(Timestamp);
    expect(after.history.some((e) => e.note?.includes("was LKR"))).toBe(true);

    await runBookingStep(tina, bookingId, "start_work");
    await runBookingStep(tina, bookingId, "complete_work");
    expect(await doc(`payments/${bookingId}`)).toMatchObject({ status: "due", totalDueLkr: 30000 });
  });

  it("lets work start on site when the scope matches, and pauses it for a mid-job revision", async () => {
    const { alice, tina, requestId } = await setup("quote_online");
    const original = await submitRemoteQuotation("tina", remote(requestId, 12000));
    const { bookingId } = await selectRemoteQuotation(alice.uid, original.id);
    await runBookingStep(tina, bookingId, "start_travel");
    await runBookingStep(tina, bookingId, "arrive");
    await runBookingStep(tina, bookingId, "start_work");

    const revised = await submitQuotation("tina", onSite(bookingId, 12000, "Found a cracked drain under the tiles"));
    expect((await doc(`bookings/${bookingId}`)).status).toBe("awaiting_customer_approval");
    await decideQuotation(alice.uid, { quotationId: revised.id, decision: "request_revision", reason: "Please itemize the drain work" });
    expect((await doc(`bookings/${bookingId}`)).status).toBe("quote_rejected");
    await expect(runBookingStep(tina, bookingId, "start_work")).rejects.toThrow(/isn't available/);
  });

  it("lets exactly one of two simultaneous selections win", async () => {
    const { alice, requestId } = await setup("quote_online");
    const a = await submitRemoteQuotation("tom", remote(requestId, 15000));
    const b = await submitRemoteQuotation("tina", remote(requestId, 12000));
    const results = await Promise.allSettled([selectRemoteQuotation(alice.uid, a.id), selectRemoteQuotation(alice.uid, b.id)]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const accepted = (await adminDb().collection("quotations").where("status", "==", "accepted").get()).size;
    expect(accepted).toBe(1);
    expect((await adminDb().collection("bookings").where("requestId", "==", requestId).get()).size).toBe(1);
  });

  it("refuses an expired quotation and marks it expired", async () => {
    const { alice, requestId } = await setup("quote_online");
    const q = await submitRemoteQuotation("tom", remote(requestId, 15000));
    await adminDb().doc(`quotations/${q.id}`).update({ validUntil: Timestamp.fromMillis(Date.now() - 1000) });
    expect((await listRemoteQuotations(alice.uid, requestId))![0].status).toBe("expired");
    await expect(selectRemoteQuotation(alice.uid, q.id)).rejects.toThrow(/expired/);
    expect((await doc(`quotations/${q.id}`)).status).toBe("expired");
    expect((await doc(`serviceRequests/${requestId}`)).status).toBe("open");
  });

  it("only takes quotations from eligible technicians, and limits versions", async () => {
    const { alice, requestId } = await setup("quote_online");
    await seedTechnician("galle", { serviceDistricts: ["Galle"] });
    await expect(submitRemoteQuotation("galle", remote(requestId, 1000))).rejects.toThrow(/districts/);
    const visit = await quoteRequest(alice, "quote_visit");
    await expect(submitRemoteQuotation("tom", remote(visit, 1000))).rejects.toThrow(/isn't a Quote Online/);

    for (const labour of [10000, 9000, 8000]) await submitRemoteQuotation("tom", remote(requestId, labour));
    await expect(submitRemoteQuotation("tom", remote(requestId, 7000))).rejects.toThrow(/up to 3 versions/);
  });

  it("treats retried submissions and selections as one", async () => {
    const { alice, requestId } = await setup("quote_online");
    const k = key();
    const a = await submitRemoteQuotation("tom", remote(requestId, 15000, k));
    const b = await submitRemoteQuotation("tom", remote(requestId, 15000, k));
    expect(b).toEqual({ id: a.id, created: false });
    const first = await selectRemoteQuotation(alice.uid, a.id);
    expect(await selectRemoteQuotation(alice.uid, a.id)).toEqual({ bookingId: first.bookingId, created: false });
  });

  it("keeps quotations private between customer and each technician", async () => {
    const { alice, requestId } = await setup("quote_online");
    const bob = await createCustomerWithAddress("bob@example.com", "0779999999");
    const q = await submitRemoteQuotation("tom", remote(requestId, 15000));
    expect(await listRemoteQuotations(bob.uid, requestId)).toBeNull();
    await expect(selectRemoteQuotation(bob.uid, q.id)).rejects.toThrow(/could not be found/);
    await expect(withdrawRemoteQuotation("tina", q.id)).rejects.toThrow(/could not be found/);

    // Technicians see the evidence and site details, never the address or another's price.
    const view = (await getTechnicianRequestView("tina", requestId))!;
    expect(view).toMatchObject({ measurements: "2 m × 2 m floor", siteConditions: "Second floor, no lift", myQuotations: [] });
    expect(JSON.stringify(view)).not.toContain("Gate code");
    expect(JSON.stringify(view)).not.toContain("Temple Road");
    expect((await getTechnicianRequestView("tom", requestId))!.myQuotations.map((x) => x.id)).toEqual([q.id]);
    void alice;
  });

  it("lists quote requests for eligible technicians with their response", async () => {
    const { requestId } = await setup("quote_online");
    await submitRemoteQuotation("tom", remote(requestId, 15000));
    expect((await listAvailableRequests("tom")).requests).toEqual([
      expect.objectContaining({ id: requestId, mode: "quote_online", myResponse: "quote_submitted" }),
    ]);
    expect((await listAvailableRequests("tina")).requests).toEqual([
      expect.objectContaining({ id: requestId, myResponse: null }),
    ]);
  });
});

describe("messages", () => {
  it("opens a thread between the customer and a responding technician only", async () => {
    const { alice, requestId } = await setup("quote_online");
    const bob = await createCustomerWithAddress("bob@example.com", "0779999999");
    await submitRemoteQuotation("tom", remote(requestId, 15000));
    const conversationId = `${requestId}_tom`;

    const clientKey = "msg-key-0000000000000001";
    await sendMessage(alice.uid, { conversationId, clientKey, body: "Does the price include grout?" });
    await sendMessage(alice.uid, { conversationId, clientKey, body: "Does the price include grout?" }); // retry
    await sendMessage("tom", { conversationId, clientKey: "msg-key-0000000000000002", body: "Yes, grout and sealant." });

    const thread = (await listMessages(alice.uid, conversationId))!;
    expect(thread.map((m) => [m.sender, m.mine, m.body])).toEqual([
      ["customer", true, "Does the price include grout?"],
      ["technician", false, "Yes, grout and sealant."],
    ]);
    expect(await listMessages(bob.uid, conversationId)).toBeNull();
    expect(await listMessages("tina", conversationId)).toBeNull();
    await expect(sendMessage("tina", { conversationId, clientKey: "msg-key-0000000000000003", body: "Hi" })).rejects.toThrow(/could not be found/);
  });
});

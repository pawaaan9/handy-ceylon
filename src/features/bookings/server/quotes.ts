import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb, adminStorage } from "@/lib/firebase/admin";
import type { OfferDoc, QuotationDoc, ServiceRequestDoc, TechnicianDoc } from "@/lib/firestore/models";
import { AuthError, UserFacingError } from "@/lib/errors";
import { colomboToday } from "@/lib/dates";
import { formatLkr } from "@/lib/format";

import { isPastDeadline, technicianEligibility } from "../eligibility";
import { computeQuotationTotals } from "../quotation";
import {
  MAX_QUOTATION_VERSIONS,
  type SelectVisitOfferInput,
  type SubmitRemoteQuotationInput,
  type SubmitVisitOfferInput,
} from "../schemas";
import { assertTransition, offerTransitions, quotationTransitions, serviceRequestTransitions } from "../state-machine";
import { bookingModeLabels, type BookingMode } from "../types";
import type { RemoteQuotationView, TechnicianRequestView, VisitOfferView } from "../views";
import { quotationIdFor, toQuotationView } from "./repository";
import {
  REQUEST_GONE,
  conversationIdFor,
  createBooking,
  iso,
  loadTechnicianViews,
  recordBookingEvent,
  recordRequestEvent,
  refs,
  writeConversation,
  type Actor,
} from "./shared";

/**
 * Get a Quote, before a booking exists:
 * - Technician Visit: eligible technicians offer a visit fee and visit times;
 *   the customer selects one offer.
 * - Quote Online: eligible technicians send sealed, itemized quotations; the
 *   customer selects one, which confirms the job at that price.
 * Selection runs in a transaction on the request, so two selections (or a
 * selection racing a withdrawal) can never both succeed.
 */
const db = () => adminDb();
const DAY_MS = 24 * 60 * 60 * 1000;

/** Request + technician checks shared by offers and quotations. */
function assertCanRespond(request: ServiceRequestDoc | undefined, mode: BookingMode, technicianUid: string, tech: TechnicianDoc | undefined) {
  if (!request) throw new UserFacingError(REQUEST_GONE);
  if (request.mode !== mode) throw new UserFacingError(`This isn't a ${bookingModeLabels[mode]} request.`);
  if (request.status !== "open" || isPastDeadline(request.expiresAt)) throw new UserFacingError(REQUEST_GONE);
  if (!tech) throw new AuthError("Your technician profile could not be found.", 403);
  const eligibility = technicianEligibility(technicianUid, tech, request);
  if (!eligibility.eligible) throw new UserFacingError(eligibility.reason);
}

// ── Technician Visit: offers ────────────────────────────────────────────────

/** Creates or updates this technician's pending offer (visit fee + visit times). */
export async function submitVisitOffer(technicianUid: string, input: SubmitVisitOfferInput): Promise<void> {
  const conversationId = conversationIdFor(input.requestId, technicianUid);
  await db().runTransaction(async (tx) => {
    const [reqSnap, techSnap, offerSnap, conversationSnap] = await tx.getAll(
      refs.request(input.requestId),
      refs.technician(technicianUid),
      refs.offer(input.requestId, technicianUid),
      refs.conversation(conversationId),
    );
    const request = reqSnap.data() as ServiceRequestDoc | undefined;
    assertCanRespond(request, "quote_visit", technicianUid, techSnap.data() as TechnicianDoc | undefined);
    const existing = offerSnap.data() as OfferDoc | undefined;
    if (existing && existing.status !== "pending") {
      throw new UserFacingError(
        existing.status === "withdrawn" || existing.status === "declined"
          ? "You've already passed on this request."
          : "Your offer can no longer be changed.",
      );
    }
    const now = FieldValue.serverTimestamp();
    tx.set(offerSnap.ref, {
      technicianId: technicianUid,
      status: "pending",
      inspectionFeeLkr: input.inspectionFeeLkr,
      etaMinutes: null,
      proposedVisits: input.proposedVisits,
      chosenVisit: null,
      message: input.message,
      bookingId: null,
      conversationId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } satisfies Record<keyof OfferDoc, unknown>);
    if (!existing) tx.update(reqSnap.ref, { offerCount: FieldValue.increment(1), updatedAt: now });
    writeConversation(tx, conversationSnap, {
      requestId: input.requestId,
      customerId: request!.customerId,
      technicianId: technicianUid,
    });
  });
}

export async function withdrawVisitOffer(technicianUid: string, requestId: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const offerSnap = await tx.get(refs.offer(requestId, technicianUid));
    const offer = offerSnap.data() as OfferDoc | undefined;
    if (!offer) throw new UserFacingError("You haven't made an offer on this request.");
    if (offer.status === "withdrawn") return;
    if (offer.status === "selected") throw new UserFacingError("The customer selected your offer. Cancel the job instead.");
    assertTransition(offerTransitions, offer.status, "withdrawn", "technician");
    tx.update(offerSnap.ref, { status: "withdrawn", updatedAt: FieldValue.serverTimestamp() });
    tx.update(refs.request(requestId), { offerCount: FieldValue.increment(-1) });
  });
}

/**
 * Customer selects one technician's offer and visit time. Creates the booking
 * at "visit_scheduled" (the customer has seen and accepted the full visit
 * fee), marks every other pending offer not selected, and is idempotent.
 */
export async function selectVisitOffer(
  customerUid: string,
  input: SelectVisitOfferInput,
): Promise<{ bookingId: string; created: boolean }> {
  const reqRef = refs.request(input.requestId);
  const bookingRef = refs.bookings().doc();
  const actor: Actor = { uid: customerUid, role: "customer" };
  const conversationId = conversationIdFor(input.requestId, input.technicianId);

  const result = await db().runTransaction(async (tx) => {
    const [reqSnap, offerSnap, techSnap, conversationSnap] = await tx.getAll(
      reqRef,
      refs.offer(input.requestId, input.technicianId),
      refs.technician(input.technicianId),
      refs.conversation(conversationId),
    );
    const request = reqSnap.data() as ServiceRequestDoc | undefined;
    if (!request || request.customerId !== customerUid) throw new UserFacingError("This request could not be found.");
    if (request.status === "assigned" && request.selectedTechnicianId === input.technicianId && request.bookingId) {
      return { bookingId: request.bookingId, created: false, expired: false }; // retried selection
    }
    if (request.mode !== "quote_visit") throw new UserFacingError("This isn't a Technician Visit request.");
    if (request.status === "assigned") throw new UserFacingError("You've already selected a technician for this request.");
    if (request.status !== "open") throw new UserFacingError(REQUEST_GONE);
    if (isPastDeadline(request.expiresAt)) {
      tx.update(reqRef, { status: "expired", updatedAt: FieldValue.serverTimestamp() });
      recordRequestEvent(tx, reqRef.id, "open", "expired", null, "No offer was selected before the deadline.");
      return { bookingId: null, created: false, expired: true };
    }
    const offer = offerSnap.data() as OfferDoc | undefined;
    if (!offer || offer.status !== "pending") {
      throw new UserFacingError("This offer is no longer available. The technician may have withdrawn it.");
    }
    const visit = offer.proposedVisits[input.visitIndex];
    if (!visit) throw new UserFacingError("Choose one of the technician's visit times.", "visitIndex");
    if (visit.date < colomboToday()) throw new UserFacingError("That visit time has passed. Choose another.", "visitIndex");
    const tech = techSnap.data() as TechnicianDoc | undefined;
    const eligibility = tech ? technicianEligibility(input.technicianId, tech, request) : null;
    if (!eligibility?.eligible) throw new UserFacingError("This technician can't take jobs right now. Choose another offer.");
    const others = await tx.get(refs.offers(input.requestId).where("status", "==", "pending"));

    assertTransition(serviceRequestTransitions, "open", "assigned", "customer", "quote_visit");
    assertTransition(offerTransitions, "pending", "selected", "customer");
    const now = FieldValue.serverTimestamp();
    tx.update(offerSnap.ref, { status: "selected", chosenVisit: visit, bookingId: bookingRef.id, updatedAt: now });
    for (const other of others.docs) {
      if (other.id !== input.technicianId) tx.update(other.ref, { status: "not_selected", updatedAt: now });
    }
    tx.update(reqRef, {
      status: "assigned",
      selectedTechnicianId: input.technicianId,
      bookingId: bookingRef.id,
      bookingStatus: "visit_scheduled",
      updatedAt: now,
    });
    createBooking(tx, bookingRef, {
      requestId: reqRef.id,
      request,
      technicianId: input.technicianId,
      status: "visit_scheduled",
      inspectionFeeLkr: offer.inspectionFeeLkr ?? 0,
      technicianMessage: offer.message,
      scheduledVisit: visit,
      visitConfirmed: true,
      conversationId,
    });
    writeConversation(tx, conversationSnap, {
      requestId: reqRef.id,
      customerId: customerUid,
      technicianId: input.technicianId,
      bookingId: bookingRef.id,
    });
    recordRequestEvent(tx, reqRef.id, "open", "assigned", actor, "Offer selected");
    recordBookingEvent(
      tx,
      bookingRef.id,
      null,
      "visit_scheduled",
      actor,
      `Visit ${visit.date} (${visit.timeSlot}), visit fee ${formatLkr(offer.inspectionFeeLkr ?? 0)}`,
    );
    return { bookingId: bookingRef.id, created: true, expired: false };
  });
  if (result.expired || !result.bookingId) throw new UserFacingError("This request has expired.");
  return { bookingId: result.bookingId, created: result.created };
}

// ── Quote Online: remote quotations ─────────────────────────────────────────

/**
 * Sends (or revises, before selection) this technician's sealed quotation.
 * A newer version supersedes their previous pending one; other technicians
 * can never read it. Retries with the same key return the same quotation.
 */
export async function submitRemoteQuotation(
  technicianUid: string,
  input: SubmitRemoteQuotationInput,
): Promise<{ id: string; created: boolean }> {
  const id = quotationIdFor(`${input.requestId}:${technicianUid}`, input.submissionKey);
  const conversationId = conversationIdFor(input.requestId, technicianUid);
  return db().runTransaction(async (tx) => {
    const [reqSnap, techSnap, existing, conversationSnap] = await tx.getAll(
      refs.request(input.requestId),
      refs.technician(technicianUid),
      refs.quotation(id),
      refs.conversation(conversationId),
    );
    if (existing.exists) return { id, created: false };
    const request = reqSnap.data() as ServiceRequestDoc | undefined;
    assertCanRespond(request, "quote_online", technicianUid, techSnap.data() as TechnicianDoc | undefined);
    const mine = await tx.get(
      refs.quotations().where("requestId", "==", input.requestId).where("technicianId", "==", technicianUid),
    );
    if (mine.size >= MAX_QUOTATION_VERSIONS) {
      throw new UserFacingError(`You can send up to ${MAX_QUOTATION_VERSIONS} versions of a quotation.`);
    }
    const pending = mine.docs.find((d) => d.get("status") === "submitted");
    const latest = mine.docs.sort((a, b) => b.get("version") - a.get("version"))[0];

    const totals = computeQuotationTotals(input.lineItems, 0);
    const now = FieldValue.serverTimestamp();
    if (pending) {
      assertTransition(quotationTransitions, "submitted", "superseded", "technician");
      tx.update(pending.ref, { status: "superseded", supersededAt: now, decidedAt: now });
    }
    tx.create(refs.quotation(id), {
      requestId: input.requestId,
      bookingId: null,
      customerId: request!.customerId,
      technicianId: technicianUid,
      mode: "quote_online",
      status: "submitted",
      version: (latest?.get("version") ?? 0) + 1,
      previousQuotationId: latest?.id ?? null,
      inspectionFindings: null,
      ...totals,
      estimatedDurationHours: input.estimatedDurationHours,
      exclusions: input.exclusions,
      assumptions: input.assumptions,
      notes: input.notes,
      revisionOfQuotationId: null,
      revisionReason: null,
      differences: null,
      decisionReason: null,
      validUntil: Timestamp.fromMillis(Date.now() + input.validForDays * DAY_MS),
      conversationId,
      createdAt: now,
      decidedAt: null,
      acceptedAt: null,
      supersededAt: null,
    } satisfies Record<keyof QuotationDoc, unknown>);
    if (!pending) tx.update(reqSnap.ref, { quotationCount: FieldValue.increment(1), updatedAt: now });
    writeConversation(tx, conversationSnap, {
      requestId: input.requestId,
      customerId: request!.customerId,
      technicianId: technicianUid,
    });
    return { id, created: true };
  });
}

export async function withdrawRemoteQuotation(technicianUid: string, quotationId: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(refs.quotation(quotationId));
    const q = snap.data() as QuotationDoc | undefined;
    if (!q || q.technicianId !== technicianUid || q.bookingId) throw new UserFacingError("This quotation could not be found.");
    if (q.status === "withdrawn") return;
    if (q.status !== "submitted") throw new UserFacingError("This quotation has already been decided.");
    assertTransition(quotationTransitions, "submitted", "withdrawn", "technician");
    tx.update(snap.ref, { status: "withdrawn", decidedAt: FieldValue.serverTimestamp() });
    tx.update(refs.request(q.requestId), { quotationCount: FieldValue.increment(-1) });
  });
}

/**
 * Customer selects one quotation. In one transaction: the quotation is
 * accepted (if still pending and unexpired, and the technician still
 * eligible), every other pending quotation becomes not selected, and a
 * booking is created already confirmed at that price, with its payment record.
 */
export async function selectRemoteQuotation(
  customerUid: string,
  quotationId: string,
): Promise<{ bookingId: string; created: boolean }> {
  const bookingRef = refs.bookings().doc();
  const actor: Actor = { uid: customerUid, role: "customer" };

  const result = await db().runTransaction(async (tx) => {
    const qSnap = await tx.get(refs.quotation(quotationId));
    const quotation = qSnap.data() as QuotationDoc | undefined;
    if (!quotation || quotation.customerId !== customerUid || quotation.mode !== "quote_online") {
      throw new UserFacingError("This quotation could not be found.");
    }
    const conversationId = conversationIdFor(quotation.requestId, quotation.technicianId);
    const [reqSnap, techSnap, conversationSnap] = await tx.getAll(
      refs.request(quotation.requestId),
      refs.technician(quotation.technicianId),
      refs.conversation(conversationId),
    );
    const request = reqSnap.data() as ServiceRequestDoc;
    if (request.status === "assigned" && request.acceptedQuotationId === quotationId && request.bookingId) {
      return { bookingId: request.bookingId, created: false, failure: null }; // retried selection
    }
    if (request.status === "assigned") throw new UserFacingError("You've already selected a quotation for this request.");
    if (request.status !== "open") throw new UserFacingError(REQUEST_GONE);
    const now = FieldValue.serverTimestamp();
    if (isPastDeadline(request.expiresAt)) {
      tx.update(reqSnap.ref, { status: "expired", updatedAt: now });
      recordRequestEvent(tx, reqSnap.id, "open", "expired", null, "No quotation was selected before the deadline.");
      return { bookingId: null, created: false, failure: "This request has expired." };
    }
    if (quotation.status !== "submitted") {
      throw new UserFacingError("This quotation is no longer available. The technician may have replaced or withdrawn it.");
    }
    if (isPastDeadline(quotation.validUntil)) {
      assertTransition(quotationTransitions, "submitted", "expired", "system");
      tx.update(qSnap.ref, { status: "expired", decidedAt: now });
      return { bookingId: null, created: false, failure: "This quotation has expired. Ask the technician for a new one." };
    }
    const tech = techSnap.data() as TechnicianDoc | undefined;
    const eligibility = tech ? technicianEligibility(quotation.technicianId, tech, request) : null;
    if (!eligibility?.eligible) throw new UserFacingError("This technician can't take jobs right now. Choose another quotation.");
    const others = await tx.get(
      refs.quotations().where("requestId", "==", quotation.requestId).where("status", "==", "submitted"),
    );

    assertTransition(serviceRequestTransitions, "open", "assigned", "customer", "quote_online");
    assertTransition(quotationTransitions, "submitted", "accepted", "customer");
    tx.update(qSnap.ref, { status: "accepted", bookingId: bookingRef.id, acceptedAt: now, decidedAt: now });
    for (const other of others.docs) {
      if (other.id !== quotationId) tx.update(other.ref, { status: "not_selected", decidedAt: now });
    }
    tx.update(reqSnap.ref, {
      status: "assigned",
      selectedTechnicianId: quotation.technicianId,
      bookingId: bookingRef.id,
      bookingStatus: "confirmed",
      acceptedQuotationId: quotationId,
      updatedAt: now,
    });
    createBooking(tx, bookingRef, {
      requestId: reqSnap.id,
      request,
      technicianId: quotation.technicianId,
      status: "confirmed",
      inspectionFeeLkr: 0,
      accepted: { quotationId, quotation },
      conversationId,
    });
    writeConversation(tx, conversationSnap, {
      requestId: reqSnap.id,
      customerId: customerUid,
      technicianId: quotation.technicianId,
      bookingId: bookingRef.id,
    });
    recordRequestEvent(tx, reqSnap.id, "open", "assigned", actor, "Quotation selected");
    recordBookingEvent(tx, bookingRef.id, null, "confirmed", actor, `Quotation selected: ${formatLkr(quotation.totalLkr)}`);
    return { bookingId: bookingRef.id, created: true, failure: null };
  });
  if (result.failure || !result.bookingId) throw new UserFacingError(result.failure ?? REQUEST_GONE);
  return { bookingId: result.bookingId, created: result.created };
}

// ── Reads ───────────────────────────────────────────────────────────────────

const toOfferView = (o: OfferDoc, technician: VisitOfferView["technician"]): VisitOfferView => ({
  technicianId: o.technicianId,
  status: o.status,
  inspectionFeeLkr: o.inspectionFeeLkr ?? 0,
  proposedVisits: o.proposedVisits ?? [],
  chosenVisit: o.chosenVisit ?? null,
  message: o.message,
  conversationId: o.conversationId ?? null,
  createdAt: iso(o.createdAt)!,
  technician,
});

/** Technician Visit offers for the customer to compare, cheapest first. Null if not their request. */
export async function listVisitOffers(customerUid: string, requestId: string): Promise<VisitOfferView[] | null> {
  const reqSnap = await refs.request(requestId).get();
  if (!reqSnap.exists || reqSnap.get("customerId") !== customerUid) return null;
  const snap = await refs.offers(requestId).where("status", "in", ["pending", "selected"]).get();
  const offers = snap.docs.map((d) => d.data() as OfferDoc);
  const technicians = await loadTechnicianViews(offers.map((o) => o.technicianId));
  return offers
    .map((o) => toOfferView(o, technicians.get(o.technicianId) ?? null))
    .sort((a, b) => a.inspectionFeeLkr - b.inspectionFeeLkr);
}

/** Quote Online quotations for the customer to compare, cheapest first. Null if not their request. */
export async function listRemoteQuotations(customerUid: string, requestId: string): Promise<RemoteQuotationView[] | null> {
  const reqSnap = await refs.request(requestId).get();
  if (!reqSnap.exists || reqSnap.get("customerId") !== customerUid) return null;
  const snap = await refs
    .quotations()
    .where("requestId", "==", requestId)
    .where("status", "in", ["submitted", "accepted", "expired"])
    .get();
  const quotes = snap.docs
    .filter((d) => d.get("bookingId") === null || d.get("status") === "accepted")
    .filter((d) => !d.get("revisionOfQuotationId"));
  const technicians = await loadTechnicianViews(quotes.map((d) => d.get("technicianId")));
  return quotes
    .map((d) => {
      const q = d.data() as QuotationDoc;
      return { ...toQuotationView(d.id, q), conversationId: q.conversationId ?? null, technician: technicians.get(q.technicianId) ?? null };
    })
    .sort((a, b) => a.totalLkr - b.totalLkr);
}

/**
 * A quote request as an eligible technician sees it — description, evidence
 * and area, never the address — plus their own offer or quotations. Null if
 * they're neither eligible nor already responding.
 */
export async function getTechnicianRequestView(
  technicianUid: string,
  requestId: string,
): Promise<TechnicianRequestView | null> {
  const [reqSnap, techSnap, offerSnap, quoteSnap] = await Promise.all([
    refs.request(requestId).get(),
    refs.technician(technicianUid).get(),
    refs.offer(requestId, technicianUid).get(),
    refs.quotations().where("requestId", "==", requestId).where("technicianId", "==", technicianUid).get(),
  ]);
  if (!reqSnap.exists || !techSnap.exists) return null;
  const request = reqSnap.data() as ServiceRequestDoc;
  if (request.mode === "urgent") return null;
  const tech = techSnap.data() as TechnicianDoc;
  const eligibility = technicianEligibility(technicianUid, tech, request);
  const responded = offerSnap.exists || !quoteSnap.empty;
  if (!responded && !eligibility.eligible) return null;
  if (!responded && (request.status !== "open" || isPastDeadline(request.expiresAt))) return null;

  const open = request.status === "open" && !isPastDeadline(request.expiresAt);
  const offer = offerSnap.data() as OfferDoc | undefined;
  const bucket = adminStorage().bucket();
  const attachments = await Promise.all(
    request.attachments.map(async (a) => {
      try {
        const [url] = await bucket.file(a.storagePath).getSignedUrl({ action: "read", expires: Date.now() + 15 * 60 * 1000 });
        return { name: a.name, kind: a.kind, url };
      } catch {
        return { name: a.name, kind: a.kind, url: null };
      }
    }),
  );
  const myQuotations = quoteSnap.docs
    .filter((d) => d.get("bookingId") === null || d.get("status") === "accepted")
    .map((d) => toQuotationView(d.id, d.data() as QuotationDoc))
    .sort((a, b) => b.version - a.version);

  return {
    id: reqSnap.id,
    mode: request.mode,
    status: open ? "open" : request.status === "open" ? "expired" : request.status,
    title: request.title,
    description: request.description,
    categoryName: request.catalogue.categoryName,
    serviceName: request.catalogue.serviceName,
    city: request.city,
    district: request.district,
    urgency: request.urgency,
    preferredSchedule: request.preferredSchedule,
    attachmentCount: request.attachments.length,
    myResponse: offer?.status === "pending" ? "offer_pending" : myQuotations.some((q) => q.status === "submitted") ? "quote_submitted" : null,
    createdAt: iso(request.createdAt)!,
    expiresAt: iso(request.expiresAt)!,
    measurements: request.measurements,
    siteConditions: request.siteConditions ?? null,
    attachments,
    blockedReason: !open ? "This request is no longer open." : eligibility.eligible ? null : eligibility.reason,
    myOffer: offer && offer.status !== "declined" ? toOfferView(offer, null) : null,
    myQuotations,
    conversationId: conversationIdFor(requestId, technicianUid),
    bookingId: request.selectedTechnicianId === technicianUid ? request.bookingId : null,
  };
}

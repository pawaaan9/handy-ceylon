import "server-only";

import { createHash } from "node:crypto";

import { FieldValue, type Timestamp, type Transaction } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { collections, subcollections } from "@/lib/firestore/collections";
import type {
  BookingDoc,
  BookingStatusEventDoc,
  OfferDoc,
  QuotationDoc,
  ServiceRequestDoc,
  ServiceRequestEventDoc,
  TechnicianDoc,
} from "@/lib/firestore/models";
import { AuthError, UserFacingError } from "@/lib/errors";
import { formatLkr } from "@/lib/format";

import { isPastDeadline, technicianEligibility, technicianReadiness } from "../eligibility";
import { computeQuotationTotals } from "../quotation";
import {
  MAX_QUOTATION_VERSIONS,
  bookingSteps,
  type AcceptUrgentRequestInput,
  type BookingStep,
  type CancelBookingInput,
  type DecideQuotationInput,
  type SubmitQuotationInput,
} from "../schemas";
import {
  assertTransition,
  bookingTransitions,
  canTransition,
  cancellationOutcome,
  quotationTransitions,
  serviceRequestTransitions,
  type CancellationOutcome,
} from "../state-machine";
import { bookingStatusLabels, type BookingStatus, type ServiceRequestStatus } from "../types";
import type {
  AvailableRequestView,
  BookingSummaryView,
  BookingView,
  QuotationView,
  TechnicianPublicView,
} from "../views";

/**
 * Get Help Now workflow. Every write happens here, inside Firestore
 * transactions, with the actor's uid and role taken from the verified session.
 * Clients only ever name a step ("confirm_visit"); the state machine decides
 * whether it is allowed from the current status, and Security Rules deny all
 * direct client writes to requests, offers, bookings and quotations.
 */
export type Actor = { uid: string; role: "customer" | "technician" | "admin" };

const db = () => adminDb();
const requestRef = (id: string) => db().collection(collections.serviceRequests).doc(id);
const requestHistoryRef = (id: string) => requestRef(id).collection(subcollections.requestHistory);
const offerRef = (requestId: string, technicianId: string) =>
  requestRef(requestId).collection(subcollections.offers).doc(technicianId);
const technicianRef = (uid: string) => db().collection(collections.technicians).doc(uid);
const bookingRef = (id: string) => db().collection(collections.bookings).doc(id);
const bookingHistoryRef = (id: string) => bookingRef(id).collection(subcollections.statusHistory);
const quotationRef = (id: string) => db().collection(collections.quotations).doc(id);

const REQUEST_GONE = "This request is no longer available.";
const BOOKING_NOT_FOUND = "This job could not be found.";
const iso = (t: unknown) => (t as Timestamp | null | undefined)?.toDate().toISOString() ?? null;

function recordBookingEvent(
  tx: Transaction,
  bookingId: string,
  from: BookingStatus | null,
  to: BookingStatus,
  actor: Actor,
  note: string | null = null,
) {
  tx.create(bookingHistoryRef(bookingId).doc(), {
    from,
    to,
    actorId: actor.uid,
    actorRole: actor.role,
    note,
    at: FieldValue.serverTimestamp(),
  } satisfies Record<keyof BookingStatusEventDoc, unknown>);
}

function recordRequestEvent(
  tx: Transaction,
  requestId: string,
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
  actor: Actor | null,
  note: string | null = null,
) {
  tx.create(requestHistoryRef(requestId).doc(), {
    from,
    to,
    actorId: actor?.uid ?? null,
    actorRole: actor?.role ?? "system",
    note,
    at: FieldValue.serverTimestamp(),
  } satisfies Record<keyof ServiceRequestEventDoc, unknown>);
}

/** A friendly error instead of the raw state-machine message. */
function assertBookingStep(from: BookingStatus, to: BookingStatus, role: Actor["role"]) {
  if (!canTransition(bookingTransitions, from, to, role)) {
    throw new UserFacingError(
      `This job is now "${bookingStatusLabels[from].toLowerCase()}", so that step isn't available. Refresh to see the latest.`,
    );
  }
}

/** Only the booking's own customer or technician (or an admin) may touch it. */
function requireParticipant(booking: BookingDoc | undefined, actor: Actor): BookingDoc {
  if (!booking) throw new UserFacingError(BOOKING_NOT_FOUND);
  const isParticipant =
    (actor.role === "customer" && booking.customerId === actor.uid) ||
    (actor.role === "technician" && booking.technicianId === actor.uid) ||
    actor.role === "admin";
  if (!isParticipant) throw new UserFacingError(BOOKING_NOT_FOUND);
  return booking;
}

// ── Technician: find, accept and decline urgent requests ───────────────────

/**
 * Accepts an urgent request in one transaction. Firestore serialises
 * transactions that touch the same request, so when several technicians
 * accept at once exactly one sees status "open" and wins; the rest are told
 * someone else accepted. A retry by the winner returns the same booking.
 */
export async function acceptUrgentRequest(
  technicianUid: string,
  input: AcceptUrgentRequestInput,
): Promise<{ bookingId: string; created: boolean }> {
  const reqRef = requestRef(input.requestId);
  const newBookingRef = db().collection(collections.bookings).doc();
  const actor: Actor = { uid: technicianUid, role: "technician" };

  const result = await db().runTransaction(async (tx) => {
    const [reqSnap, techSnap, offerSnap] = await tx.getAll(
      reqRef,
      technicianRef(technicianUid),
      offerRef(input.requestId, technicianUid),
    );
    if (!reqSnap.exists) throw new UserFacingError(REQUEST_GONE);
    const request = reqSnap.data() as ServiceRequestDoc;

    if (request.status === "assigned" && request.selectedTechnicianId === technicianUid && request.bookingId) {
      return { bookingId: request.bookingId, created: false, expired: false }; // network retry
    }
    if (request.mode !== "urgent") throw new UserFacingError("Only Get Help Now requests can be accepted directly.");
    if (request.status === "assigned") throw new UserFacingError("Another technician has already accepted this request.");
    if (request.status !== "open") throw new UserFacingError(REQUEST_GONE);
    if (isPastDeadline(request.expiresAt)) {
      // Commit the expiry, then report it (throwing here would roll it back).
      tx.update(reqRef, { status: "expired", updatedAt: FieldValue.serverTimestamp() });
      recordRequestEvent(tx, reqRef.id, "open", "expired", null, "No technician accepted before the deadline.");
      return { bookingId: null, created: false, expired: true };
    }
    const previous = offerSnap.data() as OfferDoc | undefined;
    if (previous && (previous.status === "declined" || previous.status === "withdrawn")) {
      throw new UserFacingError("You've already passed on this request.");
    }
    if (!techSnap.exists) throw new AuthError("Your technician profile could not be found.", 403);
    const eligibility = technicianEligibility(technicianUid, techSnap.data() as TechnicianDoc, request);
    if (!eligibility.eligible) throw new UserFacingError(eligibility.reason);
    assertTransition(serviceRequestTransitions, "open", "assigned", "technician");

    const now = FieldValue.serverTimestamp();
    tx.update(reqRef, {
      status: "assigned",
      selectedTechnicianId: technicianUid,
      bookingId: newBookingRef.id,
      bookingStatus: "technician_assigned",
      offerCount: FieldValue.increment(1),
      updatedAt: now,
    });
    tx.set(offerRef(reqRef.id, technicianUid), {
      technicianId: technicianUid,
      status: "selected",
      inspectionFeeLkr: input.inspectionFeeLkr,
      etaMinutes: input.etaMinutes,
      message: input.message,
      bookingId: newBookingRef.id,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof OfferDoc, unknown>);
    tx.create(newBookingRef, {
      requestId: reqRef.id,
      customerId: request.customerId,
      technicianId: technicianUid,
      participantIds: [request.customerId, technicianUid],
      mode: request.mode,
      categoryId: request.categoryId,
      status: "technician_assigned",
      summary: {
        title: request.title,
        serviceName: request.catalogue.serviceName,
        city: request.city,
        district: request.district,
      },
      inspectionFeeLkr: input.inspectionFeeLkr,
      etaMinutes: input.etaMinutes,
      technicianMessage: input.message,
      visitConfirmedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      currentQuotationId: null,
      quotationCount: 0,
      acceptedQuotationId: null,
      agreedTotalLkr: null,
      confirmedAt: null,
      workStartedAt: null,
      completedAt: null,
      cancellation: null,
      conversationId: null,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof BookingDoc, unknown>);
    recordRequestEvent(tx, reqRef.id, "open", "assigned", actor);
    recordBookingEvent(
      tx,
      newBookingRef.id,
      null,
      "technician_assigned",
      actor,
      input.inspectionFeeLkr > 0 ? `Inspection fee ${formatLkr(input.inspectionFeeLkr)}` : "Free inspection",
    );
    return { bookingId: newBookingRef.id, created: true, expired: false };
  });

  if (result.expired || !result.bookingId) throw new UserFacingError("This request has expired.");
  return { bookingId: result.bookingId, created: result.created };
}

/** The technician passes on a request; it disappears from their list. Idempotent. */
export async function declineUrgentRequest(technicianUid: string, requestId: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const [reqSnap, offerSnap] = await tx.getAll(requestRef(requestId), offerRef(requestId, technicianUid));
    if (!reqSnap.exists) throw new UserFacingError(REQUEST_GONE);
    const offer = offerSnap.data() as OfferDoc | undefined;
    if (offer?.status === "declined") return;
    if (offer?.status === "selected" && reqSnap.get("selectedTechnicianId") === technicianUid) {
      throw new UserFacingError("You've accepted this request. Cancel the job instead.");
    }
    const now = FieldValue.serverTimestamp();
    tx.set(offerRef(requestId, technicianUid), {
      technicianId: technicianUid,
      status: "declined",
      inspectionFeeLkr: null,
      etaMinutes: null,
      message: null,
      bookingId: null,
      createdAt: offer?.createdAt ?? now,
      updatedAt: now,
    } satisfies Record<keyof OfferDoc, unknown>);
  });
}

export type AvailableRequests = {
  /** null when the account can't take jobs at all (no profile, not approved). */
  technician: { availability: TechnicianDoc["availability"]; canAccept: boolean; blockedReason: string | null } | null;
  requests: AvailableRequestView[];
};

/**
 * Open urgent requests this technician could take: in their categories and
 * districts, not expired, not their own, and not already declined. Shown even
 * while offline (accepting re-checks availability inside the transaction).
 */
export async function listAvailableRequests(technicianUid: string): Promise<AvailableRequests> {
  const techSnap = await technicianRef(technicianUid).get();
  if (!techSnap.exists) return { technician: null, requests: [] };
  const tech = techSnap.data() as TechnicianDoc;
  const status = technicianReadiness(tech);
  const technician = {
    availability: tech.availability,
    canAccept: status.eligible,
    blockedReason: status.eligible ? null : status.reason,
  };
  const districts = (tech.serviceDistricts ?? []).slice(0, 30);
  if (districts.length === 0 || (tech.categoryIds ?? []).length === 0) return { technician, requests: [] };

  const snap = await db()
    .collection(collections.serviceRequests)
    .where("status", "==", "open")
    .where("mode", "==", "urgent")
    .where("district", "in", districts)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const candidates = snap.docs.filter((d) => {
    const r = d.data() as ServiceRequestDoc;
    return tech.categoryIds.includes(r.categoryId) && r.customerId !== technicianUid && !isPastDeadline(r.expiresAt);
  });
  if (candidates.length === 0) return { technician, requests: [] };

  const responses = await db().getAll(...candidates.map((d) => offerRef(d.id, technicianUid)));
  const responded = new Set(responses.filter((s) => s.exists).map((s) => s.ref.parent.parent!.id));
  return {
    technician,
    requests: candidates
      .filter((d) => !responded.has(d.id))
      .map((d) => {
        const r = d.data() as ServiceRequestDoc;
        return {
          id: d.id,
          title: r.title,
          description: r.description,
          categoryName: r.catalogue.categoryName,
          serviceName: r.catalogue.serviceName,
          city: r.city,
          district: r.district,
          urgency: r.urgency,
          attachmentCount: r.attachments.length,
          createdAt: iso(r.createdAt)!,
          expiresAt: iso(r.expiresAt)!,
        };
      }),
  };
}

/**
 * How many approved technicians are online now for this category and
 * district — what the customer is told while waiting. Never estimated.
 */
export async function countAvailableTechnicians(categoryId: string, district: string): Promise<number> {
  const snap = await db()
    .collection(collections.technicians)
    .where("availability", "==", "online")
    .where("verificationStatus", "==", "approved")
    .where("categoryIds", "array-contains", categoryId)
    .get();
  return snap.docs.filter(
    (d) => d.get("accountStatus") === "active" && ((d.get("serviceDistricts") ?? []) as string[]).includes(district),
  ).length;
}

export async function setAvailability(technicianUid: string, availability: TechnicianDoc["availability"]) {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(technicianRef(technicianUid));
    if (!snap.exists) throw new AuthError("Your technician profile could not be found.", 403);
    const tech = snap.data() as TechnicianDoc;
    if (availability === "online" && (tech.accountStatus !== "active" || tech.verificationStatus !== "approved")) {
      throw new UserFacingError("Your technician account isn't active, so you can't go online.");
    }
    tx.update(technicianRef(technicianUid), { availability, updatedAt: FieldValue.serverTimestamp() });
  });
}

// ── Booking steps ───────────────────────────────────────────────────────────

const stepDefinitions: Record<
  BookingStep,
  { to: BookingStatus; role: "customer" | "technician"; stamp: keyof BookingDoc }
> = {
  confirm_visit: { to: "visit_scheduled", role: "customer", stamp: "visitConfirmedAt" },
  start_travel: { to: "en_route", role: "technician", stamp: "enRouteAt" },
  arrive: { to: "inspecting", role: "technician", stamp: "arrivedAt" },
  start_work: { to: "work_in_progress", role: "technician", stamp: "workStartedAt" },
  complete_work: { to: "completed", role: "technician", stamp: "completedAt" },
};

/** Moves a booking one named step forward. A retried step that already happened is a no-op. */
export async function runBookingStep(actor: Actor, bookingId: string, step: BookingStep): Promise<void> {
  const def = stepDefinitions[step];
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef(bookingId));
    const booking = requireParticipant(snap.data() as BookingDoc | undefined, actor);
    if (actor.role !== def.role) throw new UserFacingError("Only the other party can do that step.");
    if (booking.status === def.to) return;
    assertBookingStep(booking.status, def.to, actor.role);

    const now = FieldValue.serverTimestamp();
    tx.update(bookingRef(bookingId), { status: def.to, [def.stamp]: now, updatedAt: now });
    tx.update(requestRef(booking.requestId), { bookingStatus: def.to, updatedAt: now });
    if (def.to === "completed") {
      tx.update(technicianRef(booking.technicianId), { completedJobs: FieldValue.increment(1) });
    }
    recordBookingEvent(tx, bookingId, booking.status, def.to, actor);
  });
}

// ── Quotations ──────────────────────────────────────────────────────────────

/** Same booking + submission key → same quotation id, so retries can't add versions. */
export function quotationIdFor(bookingId: string, submissionKey: string): string {
  return createHash("sha256").update(`${bookingId}:${submissionKey}`).digest("base64url").slice(0, 24);
}

/** Technician submits inspection findings and an itemized quotation (or a revision after rejection). */
export async function submitQuotation(
  technicianUid: string,
  input: SubmitQuotationInput,
): Promise<{ id: string; created: boolean }> {
  const id = quotationIdFor(input.bookingId, input.submissionKey);
  const actor: Actor = { uid: technicianUid, role: "technician" };

  return db().runTransaction(async (tx) => {
    const [bookingSnap, existing] = await tx.getAll(bookingRef(input.bookingId), quotationRef(id));
    const booking = bookingSnap.data() as BookingDoc | undefined;
    if (!booking || booking.technicianId !== technicianUid) throw new UserFacingError(BOOKING_NOT_FOUND);
    if (existing.exists) return { id, created: false };
    assertBookingStep(booking.status, "awaiting_customer_approval", "technician");
    if (booking.quotationCount >= MAX_QUOTATION_VERSIONS) {
      throw new UserFacingError(
        `You've sent ${MAX_QUOTATION_VERSIONS} quotations for this job. Cancel the job if you can't agree a price.`,
      );
    }
    const previous = booking.currentQuotationId ? await tx.get(quotationRef(booking.currentQuotationId)) : null;

    const totals = computeQuotationTotals(input.lineItems, booking.inspectionFeeLkr);
    const version = booking.quotationCount + 1;
    const now = FieldValue.serverTimestamp();
    if (previous?.get("status") === "submitted") {
      tx.update(previous.ref, { status: "superseded", decidedAt: now });
    }
    tx.create(quotationRef(id), {
      requestId: booking.requestId,
      bookingId: input.bookingId,
      customerId: booking.customerId,
      technicianId: technicianUid,
      mode: booking.mode,
      status: "submitted",
      version,
      previousQuotationId: booking.currentQuotationId,
      inspectionFindings: input.inspectionFindings,
      ...totals,
      estimatedDurationHours: input.estimatedDurationHours,
      notes: input.notes,
      rejectionReason: null,
      createdAt: now,
      decidedAt: null,
    } satisfies Record<keyof QuotationDoc, unknown>);
    tx.update(bookingRef(input.bookingId), {
      status: "awaiting_customer_approval",
      currentQuotationId: id,
      quotationCount: version,
      updatedAt: now,
    });
    tx.update(requestRef(booking.requestId), {
      bookingStatus: "awaiting_customer_approval",
      quotationCount: FieldValue.increment(1),
      updatedAt: now,
    });
    recordBookingEvent(
      tx,
      input.bookingId,
      booking.status,
      "awaiting_customer_approval",
      actor,
      `Quotation v${version}: ${formatLkr(totals.totalLkr)}`,
    );
    return { id, created: true };
  });
}

/** Customer approves (→ confirmed job) or rejects (→ technician may revise) the current quotation. */
export async function decideQuotation(customerUid: string, input: DecideQuotationInput): Promise<void> {
  const actor: Actor = { uid: customerUid, role: "customer" };
  await db().runTransaction(async (tx) => {
    const qSnap = await tx.get(quotationRef(input.quotationId));
    const quotation = qSnap.data() as QuotationDoc | undefined;
    if (!quotation || quotation.customerId !== customerUid) throw new UserFacingError("This quotation could not be found.");
    const bSnap = await tx.get(bookingRef(quotation.bookingId));
    const booking = requireParticipant(bSnap.data() as BookingDoc | undefined, actor);

    const approve = input.decision === "approve";
    const target = approve ? "accepted" : "rejected";
    if (quotation.status === target) return; // retried decision
    if (quotation.status !== "submitted" || booking.currentQuotationId !== input.quotationId) {
      throw new UserFacingError("This quotation has already been decided or replaced. Refresh to see the latest.");
    }
    const to: BookingStatus = approve ? "confirmed" : "quote_rejected";
    assertBookingStep(booking.status, to, "customer");
    assertTransition(quotationTransitions, "submitted", target, "customer");

    const now = FieldValue.serverTimestamp();
    tx.update(qSnap.ref, {
      status: target,
      decidedAt: now,
      rejectionReason: approve ? null : input.reason,
    });
    tx.update(bSnap.ref, {
      status: to,
      updatedAt: now,
      ...(approve
        ? { acceptedQuotationId: input.quotationId, agreedTotalLkr: quotation.totalLkr, confirmedAt: now }
        : {}),
    });
    tx.update(requestRef(booking.requestId), {
      bookingStatus: to,
      updatedAt: now,
      ...(approve ? { acceptedQuotationId: input.quotationId } : {}),
    });
    recordBookingEvent(
      tx,
      quotation.bookingId,
      booking.status,
      to,
      actor,
      approve ? `Approved ${formatLkr(quotation.totalLkr)}` : `Rejected: ${input.reason}`,
    );
  });
}

// ── Cancellation ────────────────────────────────────────────────────────────

/**
 * Who may cancel when is the bookingTransitions table. A technician pulling
 * out before arrival reopens the request for other technicians (or expires
 * it, if its deadline passed); any other cancellation closes the request.
 */
export async function cancelBooking(actor: Actor, input: CancelBookingInput): Promise<CancellationOutcome> {
  return db().runTransaction(async (tx) => {
    const bSnap = await tx.get(bookingRef(input.bookingId));
    const booking = requireParticipant(bSnap.data() as BookingDoc | undefined, actor);
    if (booking.status === "cancelled") {
      return { reopensRequest: false, inspectionFeeDue: booking.cancellation?.inspectionFeeDue ?? false };
    }
    if (!canTransition(bookingTransitions, booking.status, "cancelled", actor.role)) {
      throw new UserFacingError(
        booking.status === "completed"
          ? "This job is already completed."
          : `You can't cancel once the job is "${bookingStatusLabels[booking.status].toLowerCase()}". Contact Handy Ceylon support.`,
      );
    }
    const [reqSnap, quotationSnap] = await Promise.all([
      tx.get(requestRef(booking.requestId)),
      booking.currentQuotationId ? tx.get(quotationRef(booking.currentQuotationId)) : Promise.resolve(null),
    ]);
    const request = reqSnap.data() as ServiceRequestDoc | undefined;
    const outcome = cancellationOutcome(booking.status, actor.role, booking.inspectionFeeLkr);
    const now = FieldValue.serverTimestamp();

    tx.update(bSnap.ref, {
      status: "cancelled",
      cancellation: {
        by: actor.role,
        actorId: actor.uid,
        reason: input.reason,
        fromStatus: booking.status,
        inspectionFeeDue: outcome.inspectionFeeDue,
        at: now,
      },
      updatedAt: now,
    });
    if (quotationSnap?.get("status") === "submitted") {
      assertTransition(quotationTransitions, "submitted", "withdrawn", actor.role);
      tx.update(quotationSnap.ref, { status: "withdrawn", decidedAt: now });
    }

    // Only touch the request if this booking is still the one it points at.
    if (request?.status === "assigned" && request.bookingId === input.bookingId) {
      if (outcome.reopensRequest) {
        const to: ServiceRequestStatus = isPastDeadline(request.expiresAt) ? "expired" : "open";
        assertTransition(serviceRequestTransitions, "assigned", to, "technician");
        tx.update(reqSnap.ref, {
          status: to,
          selectedTechnicianId: null,
          bookingId: null,
          bookingStatus: null,
          updatedAt: now,
        });
        tx.update(offerRef(booking.requestId, booking.technicianId), { status: "withdrawn", updatedAt: now });
        recordRequestEvent(tx, booking.requestId, "assigned", to, actor, `Technician withdrew: ${input.reason}`);
      } else {
        assertTransition(serviceRequestTransitions, "assigned", "cancelled", actor.role);
        tx.update(reqSnap.ref, {
          status: "cancelled",
          bookingStatus: "cancelled",
          cancellation: { by: actor.role, actorId: actor.uid, reason: "booking_cancelled", note: input.reason, at: now },
          updatedAt: now,
        });
        recordRequestEvent(tx, booking.requestId, "assigned", "cancelled", actor, input.reason);
      }
    }
    recordBookingEvent(
      tx,
      input.bookingId,
      booking.status,
      "cancelled",
      actor,
      outcome.inspectionFeeDue ? `${input.reason} (inspection fee ${formatLkr(booking.inspectionFeeLkr)} due)` : input.reason,
    );
    return outcome;
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

function toSummary(id: string, b: BookingDoc): BookingSummaryView {
  return {
    id,
    requestId: b.requestId,
    mode: b.mode,
    status: b.status,
    title: b.summary.title,
    serviceName: b.summary.serviceName,
    city: b.summary.city,
    district: b.summary.district,
    inspectionFeeLkr: b.inspectionFeeLkr,
    agreedTotalLkr: b.agreedTotalLkr,
    createdAt: iso(b.createdAt)!,
    updatedAt: iso(b.updatedAt)!,
  };
}

export async function listTechnicianBookings(technicianUid: string, limit = 50): Promise<BookingSummaryView[]> {
  const snap = await db()
    .collection(collections.bookings)
    .where("technicianId", "==", technicianUid)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => toSummary(d.id, d.data() as BookingDoc));
}

function toTechnicianView(uid: string, t: TechnicianDoc, showPhone: boolean): TechnicianPublicView {
  return {
    uid,
    displayName: t.displayName,
    photoURL: t.photoURL ?? null,
    phoneNumber: showPhone ? t.phoneNumber : null,
    verified: t.verificationStatus === "approved" && t.accountStatus === "active",
    approvedAt: iso(t.approvedAt),
    yearsOfExperience: t.yearsOfExperience ?? 0,
    skills: t.skills ?? [],
    city: t.city,
    district: t.district,
    ratingAverage: t.ratingAverage ?? 0,
    ratingCount: t.ratingCount ?? 0,
    completedJobs: t.completedJobs ?? 0,
  };
}

/** The booking for one of its participants (or an admin); null for anyone else. */
export async function getBookingView(viewer: Actor, bookingId: string): Promise<BookingView | null> {
  const snap = await bookingRef(bookingId).get();
  if (!snap.exists) return null;
  const booking = snap.data() as BookingDoc;
  const allowed =
    viewer.role === "admin" ||
    (viewer.role === "customer" && booking.customerId === viewer.uid) ||
    (viewer.role === "technician" && booking.technicianId === viewer.uid);
  if (!allowed) return null;

  const [quotationSnap, historySnap, techSnap] = await Promise.all([
    db().collection(collections.quotations).where("bookingId", "==", bookingId).get(),
    bookingHistoryRef(bookingId).orderBy("at", "asc").get(),
    technicianRef(booking.technicianId).get(),
  ]);
  const quotations: QuotationView[] = quotationSnap.docs
    .map((d) => {
      const q = d.data() as QuotationDoc;
      return {
        id: d.id,
        status: q.status,
        version: q.version,
        inspectionFindings: q.inspectionFindings,
        lineItems: q.lineItems,
        labourLkr: q.labourLkr,
        materialsLkr: q.materialsLkr,
        additionalLkr: q.additionalLkr,
        inspectionFeeLkr: q.inspectionFeeLkr,
        totalLkr: q.totalLkr,
        estimatedDurationHours: q.estimatedDurationHours,
        notes: q.notes,
        rejectionReason: q.rejectionReason,
        createdAt: iso(q.createdAt)!,
        decidedAt: iso(q.decidedAt),
      };
    })
    .sort((a, b) => b.version - a.version);

  const active = !["completed", "cancelled"].includes(booking.status);
  const role = viewer.role;
  const current = quotations.find((q) => q.id === booking.currentQuotationId);

  return {
    ...toSummary(snap.id, booking),
    customerId: booking.customerId,
    technicianId: booking.technicianId,
    etaMinutes: booking.etaMinutes,
    technicianMessage: booking.technicianMessage,
    visitConfirmedAt: iso(booking.visitConfirmedAt),
    enRouteAt: iso(booking.enRouteAt),
    arrivedAt: iso(booking.arrivedAt),
    confirmedAt: iso(booking.confirmedAt),
    workStartedAt: iso(booking.workStartedAt),
    completedAt: iso(booking.completedAt),
    quotationCount: booking.quotationCount,
    cancellation: booking.cancellation
      ? {
          by: booking.cancellation.by,
          reason: booking.cancellation.reason,
          fromStatus: booking.cancellation.fromStatus,
          inspectionFeeDue: booking.cancellation.inspectionFeeDue,
          at: iso(booking.cancellation.at)!,
        }
      : null,
    technician: techSnap.exists ? toTechnicianView(techSnap.id, techSnap.data() as TechnicianDoc, active) : null,
    quotations,
    history: historySnap.docs.map((d) => {
      const e = d.data() as BookingStatusEventDoc;
      return { from: e.from, to: e.to, actorRole: e.actorRole, note: e.note, at: iso(e.at)! };
    }),
    allowed: {
      steps: bookingSteps.filter(
        (step) =>
          stepDefinitions[step].role === role &&
          canTransition(bookingTransitions, booking.status, stepDefinitions[step].to, role),
      ),
      submitQuotation:
        role === "technician" &&
        canTransition(bookingTransitions, booking.status, "awaiting_customer_approval", role) &&
        booking.quotationCount < MAX_QUOTATION_VERSIONS,
      decideQuotationId:
        role === "customer" && booking.status === "awaiting_customer_approval" && current?.status === "submitted"
          ? current.id
          : null,
      cancel: canTransition(bookingTransitions, booking.status, "cancelled", role)
        ? cancellationOutcome(booking.status, role, booking.inspectionFeeLkr)
        : null,
    },
  };
}

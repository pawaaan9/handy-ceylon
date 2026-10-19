import "server-only";

import { createHash } from "node:crypto";

import { FieldValue, Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type {
  BookingDoc,
  BookingStatusEventDoc,
  OfferDoc,
  PaymentDoc,
  QuotationDoc,
  ServiceRequestDoc,
  TechnicianDoc,
} from "@/lib/firestore/models";
import { AuthError, UserFacingError } from "@/lib/errors";
import { formatLkr } from "@/lib/format";

import { accountReadiness, isPastDeadline, technicianEligibility, technicianReadiness } from "../eligibility";
import { computeQuotationTotals, quotationDifferences } from "../quotation";
import {
  MAX_QUOTATION_VERSIONS,
  ON_SITE_QUOTE_VALID_DAYS,
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
import type { AvailableRequestView, BookingSummaryView, BookingView, MyResponse, QuotationView } from "../views";
import {
  BOOKING_NOT_FOUND,
  REQUEST_GONE,
  assertBookingStep,
  conversationIdFor,
  createBooking,
  iso,
  paymentWrites,
  recordBookingEvent,
  recordRequestEvent,
  refs,
  requireParticipant,
  toTechnicianView,
  writeConversation,
  type Actor,
} from "./shared";

export type { Actor } from "./shared";

/**
 * Get Help Now, plus everything that happens to a booking once it exists
 * (steps, quotations and revisions, decisions, cancellation) for all three
 * options. Clients only ever name a step; the state machine decides whether
 * it is allowed from the current status and booking mode.
 */
const db = () => adminDb();
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Technician: find, accept and decline requests ──────────────────────────

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
  const reqRef = refs.request(input.requestId);
  const newBookingRef = refs.bookings().doc();
  const actor: Actor = { uid: technicianUid, role: "technician" };
  const conversationId = conversationIdFor(input.requestId, technicianUid);

  const result = await db().runTransaction(async (tx) => {
    const [reqSnap, techSnap, offerSnap, conversationSnap] = await tx.getAll(
      reqRef,
      refs.technician(technicianUid),
      refs.offer(input.requestId, technicianUid),
      refs.conversation(conversationId),
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
    assertTransition(serviceRequestTransitions, "open", "assigned", "technician", "urgent");

    const now = FieldValue.serverTimestamp();
    tx.update(reqRef, {
      status: "assigned",
      selectedTechnicianId: technicianUid,
      bookingId: newBookingRef.id,
      bookingStatus: "technician_assigned",
      offerCount: FieldValue.increment(1),
      updatedAt: now,
    });
    tx.set(refs.offer(reqRef.id, technicianUid), {
      technicianId: technicianUid,
      status: "selected",
      inspectionFeeLkr: input.inspectionFeeLkr,
      etaMinutes: input.etaMinutes,
      proposedVisits: [],
      chosenVisit: null,
      message: input.message,
      bookingId: newBookingRef.id,
      conversationId,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof OfferDoc, unknown>);
    createBooking(tx, newBookingRef, {
      requestId: reqRef.id,
      request,
      technicianId: technicianUid,
      status: "technician_assigned",
      inspectionFeeLkr: input.inspectionFeeLkr,
      etaMinutes: input.etaMinutes,
      technicianMessage: input.message,
      conversationId,
    });
    writeConversation(tx, conversationSnap, {
      requestId: reqRef.id,
      customerId: request.customerId,
      technicianId: technicianUid,
      bookingId: newBookingRef.id,
    });
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

/** The technician passes on a request (any option); it disappears from their list. Idempotent. */
export async function declineRequest(technicianUid: string, requestId: string): Promise<void> {
  await db().runTransaction(async (tx) => {
    const [reqSnap, offerSnap] = await tx.getAll(refs.request(requestId), refs.offer(requestId, technicianUid));
    if (!reqSnap.exists) throw new UserFacingError(REQUEST_GONE);
    const offer = offerSnap.data() as OfferDoc | undefined;
    if (offer?.status === "declined") return;
    if (offer?.status === "selected" && reqSnap.get("selectedTechnicianId") === technicianUid) {
      throw new UserFacingError("You've got this job. Cancel the job instead.");
    }
    if (offer?.status === "pending") throw new UserFacingError("Withdraw your offer first.");
    const now = FieldValue.serverTimestamp();
    tx.set(refs.offer(requestId, technicianUid), {
      technicianId: technicianUid,
      status: "declined",
      inspectionFeeLkr: null,
      etaMinutes: null,
      proposedVisits: [],
      chosenVisit: null,
      message: null,
      bookingId: null,
      conversationId: offer?.conversationId ?? null,
      createdAt: offer?.createdAt ?? now,
      updatedAt: now,
    } satisfies Record<keyof OfferDoc, unknown>);
  });
}

export type AvailableRequests = {
  /** null when the account has no technician profile. */
  technician: {
    availability: TechnicianDoc["availability"];
    canAcceptUrgent: boolean;
    canQuote: boolean;
    blockedReason: string | null;
  } | null;
  requests: AvailableRequestView[];
};

/**
 * Open requests this technician could respond to: in their categories and
 * districts, not expired, not their own and not declined. Urgent requests
 * they already answered drop out; quote requests stay, marked with their
 * response. Shown even while offline (accepting re-checks inside the transaction).
 */
export async function listAvailableRequests(technicianUid: string): Promise<AvailableRequests> {
  const techSnap = await refs.technician(technicianUid).get();
  if (!techSnap.exists) return { technician: null, requests: [] };
  const tech = techSnap.data() as TechnicianDoc;
  const urgent = technicianReadiness(tech);
  const quoting = accountReadiness(tech);
  const technician = {
    availability: tech.availability,
    canAcceptUrgent: urgent.eligible,
    canQuote: quoting.eligible,
    blockedReason: urgent.eligible ? null : urgent.reason,
  };
  const districts = (tech.serviceDistricts ?? []).slice(0, 30);
  if (districts.length === 0 || (tech.categoryIds ?? []).length === 0) return { technician, requests: [] };

  const snap = await db()
    .collection(collections.serviceRequests)
    .where("status", "==", "open")
    .where("district", "in", districts)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const candidates = snap.docs.filter((d) => {
    const r = d.data() as ServiceRequestDoc;
    return tech.categoryIds.includes(r.categoryId) && r.customerId !== technicianUid && !isPastDeadline(r.expiresAt);
  });
  if (candidates.length === 0) return { technician, requests: [] };

  const [offers, quotes] = await Promise.all([
    db().getAll(...candidates.map((d) => refs.offer(d.id, technicianUid))),
    refs.quotations().where("technicianId", "==", technicianUid).where("status", "==", "submitted").get(),
  ]);
  const offerStatus = new Map(offers.filter((s) => s.exists).map((s) => [s.ref.parent.parent!.id, s.get("status") as string]));
  const quoted = new Set(quotes.docs.map((d) => d.get("requestId") as string));

  return {
    technician,
    requests: candidates.flatMap((d) => {
      const r = d.data() as ServiceRequestDoc;
      const offered = offerStatus.get(d.id);
      if (offered === "declined" || offered === "withdrawn") return [];
      if (r.mode === "urgent" && offered) return [];
      const myResponse: MyResponse =
        offered === "pending" ? "offer_pending" : quoted.has(d.id) ? "quote_submitted" : null;
      return [
        {
          id: d.id,
          mode: r.mode,
          title: r.title,
          description: r.description,
          categoryName: r.catalogue.categoryName,
          serviceName: r.catalogue.serviceName,
          city: r.city,
          district: r.district,
          urgency: r.urgency,
          preferredSchedule: r.preferredSchedule,
          attachmentCount: r.attachments.length,
          myResponse,
          createdAt: iso(r.createdAt)!,
          expiresAt: iso(r.expiresAt)!,
        },
      ];
    }),
  };
}

/**
 * Approved, active technicians covering this category and district — and,
 * for Get Help Now, marked online right now. What customers are told while
 * waiting; never estimated.
 */
export async function countAvailableTechnicians(
  categoryId: string,
  district: string,
  { requireOnline = true }: { requireOnline?: boolean } = {},
): Promise<number> {
  let query = db()
    .collection(collections.technicians)
    .where("verificationStatus", "==", "approved")
    .where("categoryIds", "array-contains", categoryId);
  if (requireOnline) query = query.where("availability", "==", "online");
  const snap = await query.get();
  return snap.docs.filter(
    (d) => d.get("accountStatus") === "active" && ((d.get("serviceDistricts") ?? []) as string[]).includes(district),
  ).length;
}

export async function setAvailability(technicianUid: string, availability: TechnicianDoc["availability"]) {
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(refs.technician(technicianUid));
    if (!snap.exists) throw new AuthError("Your technician profile could not be found.", 403);
    const tech = snap.data() as TechnicianDoc;
    if (availability === "online" && !accountReadiness(tech).eligible) {
      throw new UserFacingError("Your technician account isn't active, so you can't go online.");
    }
    tx.update(refs.technician(technicianUid), { availability, updatedAt: FieldValue.serverTimestamp() });
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
    const snap = await tx.get(refs.booking(bookingId));
    const booking = requireParticipant(snap.data() as BookingDoc | undefined, actor);
    if (actor.role !== def.role) throw new UserFacingError("Only the other party can do that step.");
    if (booking.status === def.to) return;
    assertBookingStep(booking, def.to, actor.role);
    // Defence in depth: paid work always rests on an accepted quotation.
    if (def.to === "work_in_progress" && !booking.acceptedQuotationId) {
      throw new UserFacingError("Work can start only after the customer approves a quotation.");
    }

    const now = FieldValue.serverTimestamp();
    tx.update(refs.booking(bookingId), { status: def.to, [def.stamp]: now, updatedAt: now });
    tx.update(refs.request(booking.requestId), { bookingStatus: def.to, updatedAt: now });
    if (def.to === "completed") {
      tx.update(refs.technician(booking.technicianId), { completedJobs: FieldValue.increment(1) });
      paymentWrites.completed(tx, bookingId);
    }
    recordBookingEvent(tx, bookingId, booking.status, def.to, actor);
  });
}

// ── Quotations on a booking (on-site quotes and price-change revisions) ─────

/** Same scope + submission key → same quotation id, so retries can't add versions. */
export function quotationIdFor(scope: string, submissionKey: string): string {
  return createHash("sha256").update(`${scope}:${submissionKey}`).digest("base64url").slice(0, 24);
}

/**
 * Technician submits an itemized quotation for a booking: the first one after
 * inspecting, a revision the customer asked for, or — once a quotation was
 * accepted — a price change, which needs a reason and records the itemized
 * differences. The accepted quotation itself is never edited.
 */
export async function submitQuotation(
  technicianUid: string,
  input: SubmitQuotationInput,
): Promise<{ id: string; created: boolean }> {
  const id = quotationIdFor(input.bookingId, input.submissionKey);
  const actor: Actor = { uid: technicianUid, role: "technician" };

  return db().runTransaction(async (tx) => {
    const [bookingSnap, existing] = await tx.getAll(refs.booking(input.bookingId), refs.quotation(id));
    const booking = bookingSnap.data() as BookingDoc | undefined;
    if (!booking || booking.technicianId !== technicianUid) throw new UserFacingError(BOOKING_NOT_FOUND);
    if (existing.exists) return { id, created: false };
    assertBookingStep(booking, "awaiting_customer_approval", "technician");
    if (booking.quotationCount >= MAX_QUOTATION_VERSIONS) {
      throw new UserFacingError(
        `You've sent ${MAX_QUOTATION_VERSIONS} quotations for this job. Cancel the job if you can't agree a price.`,
      );
    }
    const [previous, accepted] = await Promise.all([
      booking.currentQuotationId ? tx.get(refs.quotation(booking.currentQuotationId)) : Promise.resolve(null),
      booking.acceptedQuotationId ? tx.get(refs.quotation(booking.acceptedQuotationId)) : Promise.resolve(null),
    ]);
    const acceptedQuote = accepted?.data() as QuotationDoc | undefined;
    if (acceptedQuote && !input.revisionReason) {
      throw new UserFacingError(
        "Explain why the price or scope changed — the customer must approve the difference before extra work.",
        "revisionReason",
      );
    }

    const totals = computeQuotationTotals(input.lineItems, booking.inspectionFeeLkr);
    const version = booking.quotationCount + 1;
    const now = FieldValue.serverTimestamp();
    if (previous?.get("status") === "submitted") {
      tx.update(previous.ref, { status: "superseded", supersededAt: now, decidedAt: now });
    }
    tx.create(refs.quotation(id), {
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
      exclusions: null,
      assumptions: null,
      notes: input.notes,
      revisionOfQuotationId: acceptedQuote ? booking.acceptedQuotationId : null,
      revisionReason: acceptedQuote ? input.revisionReason : null,
      differences: acceptedQuote ? quotationDifferences(acceptedQuote, totals) : null,
      decisionReason: null,
      validUntil: Timestamp.fromMillis(Date.now() + ON_SITE_QUOTE_VALID_DAYS * DAY_MS),
      conversationId: booking.conversationId,
      createdAt: now,
      decidedAt: null,
      acceptedAt: null,
      supersededAt: null,
    } satisfies Record<keyof QuotationDoc, unknown>);
    tx.update(refs.booking(input.bookingId), {
      status: "awaiting_customer_approval",
      currentQuotationId: id,
      quotationCount: version,
      updatedAt: now,
    });
    tx.update(refs.request(booking.requestId), {
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
      acceptedQuote
        ? `Revised quotation v${version}: ${formatLkr(totals.totalLkr)} (was ${formatLkr(acceptedQuote.totalLkr)}) — ${input.revisionReason}`
        : `Quotation v${version}: ${formatLkr(totals.totalLkr)}`,
    );
    return { id, created: true };
  });
}

/**
 * Customer decides the current quotation on a booking:
 * - approve → job confirmed at this price (a previously accepted quotation is superseded, not edited)
 * - request_revision → the technician sends a new version
 * - reject → the job is cancelled
 */
export async function decideQuotation(customerUid: string, input: DecideQuotationInput): Promise<void> {
  const actor: Actor = { uid: customerUid, role: "customer" };
  const result = await db().runTransaction(async (tx) => {
    const qSnap = await tx.get(refs.quotation(input.quotationId));
    const quotation = qSnap.data() as QuotationDoc | undefined;
    if (!quotation || quotation.customerId !== customerUid) throw new UserFacingError("This quotation could not be found.");
    if (!quotation.bookingId) throw new UserFacingError("Select this quotation from your request instead.");
    const [bSnap, reqSnap] = await tx.getAll(refs.booking(quotation.bookingId), refs.request(quotation.requestId));
    const booking = requireParticipant(bSnap.data() as BookingDoc | undefined, actor);

    const target = { approve: "accepted", request_revision: "revision_requested", reject: "rejected" }[input.decision];
    if (quotation.status === target) return { expired: false }; // retried decision
    if (quotation.status !== "submitted" || booking.currentQuotationId !== input.quotationId) {
      throw new UserFacingError("This quotation has already been decided or replaced. Refresh to see the latest.");
    }
    const now = FieldValue.serverTimestamp();

    if (input.decision === "approve" && quotation.validUntil && isPastDeadline(quotation.validUntil)) {
      assertTransition(quotationTransitions, "submitted", "expired", "system");
      tx.update(qSnap.ref, { status: "expired", decidedAt: now });
      tx.update(bSnap.ref, { status: "quote_rejected", updatedAt: now });
      tx.update(reqSnap.ref, { bookingStatus: "quote_rejected", updatedAt: now });
      recordBookingEvent(tx, quotation.bookingId, booking.status, "quote_rejected", null, "Quotation expired before approval");
      return { expired: true };
    }

    if (input.decision === "reject") {
      assertTransition(quotationTransitions, "submitted", "rejected", "customer");
      assertBookingStep(booking, "cancelled", "customer");
      const outcome = cancellationOutcome(booking.status, "customer", booking.inspectionFeeLkr);
      tx.update(qSnap.ref, { status: "rejected", decisionReason: input.reason, decidedAt: now });
      writeCancellation(tx, {
        bookingId: quotation.bookingId,
        booking,
        request: reqSnap.data() as ServiceRequestDoc | undefined,
        currentQuotation: null, // decided above
        restore: [],
        actor,
        reason: `Quotation rejected: ${input.reason}`,
        outcome,
      });
      return { expired: false };
    }

    const approve = input.decision === "approve";
    const to: BookingStatus = approve ? "confirmed" : "quote_rejected";
    assertBookingStep(booking, to, "customer");
    assertTransition(quotationTransitions, "submitted", target as "accepted" | "revision_requested", "customer");
    const previousAccepted =
      approve && booking.acceptedQuotationId ? await tx.get(refs.quotation(booking.acceptedQuotationId)) : null;

    tx.update(qSnap.ref, {
      status: target,
      decidedAt: now,
      decisionReason: approve ? null : input.reason,
      ...(approve ? { acceptedAt: now } : {}),
    });
    if (previousAccepted?.exists) {
      assertTransition(quotationTransitions, "accepted", "superseded", "customer");
      tx.update(previousAccepted.ref, { status: "superseded", supersededAt: now });
    }
    tx.update(bSnap.ref, {
      status: to,
      updatedAt: now,
      ...(approve
        ? { acceptedQuotationId: input.quotationId, agreedTotalLkr: quotation.totalLkr, confirmedAt: now }
        : {}),
    });
    tx.update(reqSnap.ref, {
      bookingStatus: to,
      updatedAt: now,
      ...(approve ? { acceptedQuotationId: input.quotationId } : {}),
    });
    if (approve) paymentWrites.accepted(tx, quotation.bookingId, input.quotationId, quotation);
    recordBookingEvent(
      tx,
      quotation.bookingId,
      booking.status,
      to,
      actor,
      approve
        ? `Approved ${formatLkr(quotation.totalLkr)}${previousAccepted?.exists ? ` (was ${formatLkr(previousAccepted.get("totalLkr"))})` : ""}`
        : `Revision requested: ${input.reason}`,
    );
    return { expired: false };
  });
  if (result.expired) {
    throw new UserFacingError("This quotation has expired. The technician has been asked for a revised one.");
  }
}

// ── Cancellation ────────────────────────────────────────────────────────────

type CancellationWrite = {
  bookingId: string;
  booking: BookingDoc;
  request: ServiceRequestDoc | undefined;
  /** Pre-read current quotation, withdrawn if still pending. */
  currentQuotation: DocumentSnapshot | null;
  /** Pre-read not_selected offers/quotations to restore when the request reopens. */
  restore: DocumentSnapshot[];
  actor: Actor;
  reason: string;
  outcome: CancellationOutcome;
};

/** All cancellation writes; every read must have happened before this is called. */
function writeCancellation(tx: Transaction, c: CancellationWrite) {
  const now = FieldValue.serverTimestamp();
  const { booking, request, actor, outcome } = c;
  tx.update(refs.booking(c.bookingId), {
    status: "cancelled",
    cancellation: {
      by: actor.role,
      actorId: actor.uid,
      reason: c.reason,
      fromStatus: booking.status,
      inspectionFeeDue: outcome.inspectionFeeDue,
      at: now,
    },
    updatedAt: now,
  });
  paymentWrites.cancelled(tx, c.bookingId, outcome.inspectionFeeDue ? booking.inspectionFeeLkr : 0);
  if (c.currentQuotation?.get("status") === "submitted") {
    assertTransition(quotationTransitions, "submitted", "withdrawn", actor.role);
    tx.update(c.currentQuotation.ref, { status: "withdrawn", decidedAt: now });
  }

  // Only touch the request if this booking is still the one it points at.
  if (request?.status === "assigned" && request.bookingId === c.bookingId) {
    if (outcome.reopensRequest) {
      const to: ServiceRequestStatus = isPastDeadline(request.expiresAt) ? "expired" : "open";
      assertTransition(serviceRequestTransitions, "assigned", to, "technician");
      tx.update(refs.request(booking.requestId), {
        status: to,
        selectedTechnicianId: null,
        bookingId: null,
        bookingStatus: null,
        acceptedQuotationId: null,
        updatedAt: now,
      });
      tx.set(refs.offer(booking.requestId, booking.technicianId), { status: "withdrawn", updatedAt: now }, { merge: true });
      if (to === "open") {
        // Give the other technicians' offers and quotations back to the customer.
        for (const snap of c.restore) {
          const isQuotation = snap.ref.parent.id === collections.quotations;
          if (isQuotation && isPastDeadline(snap.get("validUntil"))) continue;
          tx.update(snap.ref, isQuotation ? { status: "submitted", decidedAt: null } : { status: "pending", updatedAt: now });
        }
      }
      recordRequestEvent(tx, booking.requestId, "assigned", to, actor, `Technician withdrew: ${c.reason}`);
    } else {
      assertTransition(serviceRequestTransitions, "assigned", "cancelled", actor.role);
      tx.update(refs.request(booking.requestId), {
        status: "cancelled",
        bookingStatus: "cancelled",
        cancellation: { by: actor.role, actorId: actor.uid, reason: "booking_cancelled", note: c.reason, at: now },
        updatedAt: now,
      });
      recordRequestEvent(tx, booking.requestId, "assigned", "cancelled", actor, c.reason);
    }
  }
  recordBookingEvent(
    tx,
    c.bookingId,
    booking.status,
    "cancelled",
    actor,
    outcome.inspectionFeeDue ? `${c.reason} (visit fee ${formatLkr(booking.inspectionFeeLkr)} due)` : c.reason,
  );
}

/**
 * Who may cancel when is the bookingTransitions table. A technician pulling
 * out before arrival reopens the request (restoring other technicians' offers
 * or quotations), or expires it if its deadline passed; any other
 * cancellation closes the request.
 */
export async function cancelBooking(actor: Actor, input: CancelBookingInput): Promise<CancellationOutcome> {
  return db().runTransaction(async (tx) => {
    const bSnap = await tx.get(refs.booking(input.bookingId));
    const booking = requireParticipant(bSnap.data() as BookingDoc | undefined, actor);
    if (booking.status === "cancelled") {
      return { reopensRequest: false, inspectionFeeDue: booking.cancellation?.inspectionFeeDue ?? false };
    }
    if (!canTransition(bookingTransitions, booking.status, "cancelled", actor.role, booking.mode)) {
      throw new UserFacingError(
        booking.status === "completed"
          ? "This job is already completed."
          : `You can't cancel once the job is "${bookingStatusLabels[booking.status].toLowerCase()}". Contact Handy Ceylon support.`,
      );
    }
    const outcome = cancellationOutcome(booking.status, actor.role, booking.inspectionFeeLkr);
    const [reqSnap, quotationSnap, restoreOffers, restoreQuotes] = await Promise.all([
      tx.get(refs.request(booking.requestId)),
      booking.currentQuotationId ? tx.get(refs.quotation(booking.currentQuotationId)) : Promise.resolve(null),
      outcome.reopensRequest ? tx.get(refs.offers(booking.requestId).where("status", "==", "not_selected")) : null,
      outcome.reopensRequest
        ? tx.get(refs.quotations().where("requestId", "==", booking.requestId).where("status", "==", "not_selected"))
        : null,
    ]);
    writeCancellation(tx, {
      bookingId: input.bookingId,
      booking,
      request: reqSnap.data() as ServiceRequestDoc | undefined,
      currentQuotation: quotationSnap,
      restore: [...(restoreOffers?.docs ?? []), ...(restoreQuotes?.docs ?? [])],
      actor,
      reason: input.reason,
      outcome,
    });
    return outcome;
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Serialisable quotation; a pending one past its validUntil reads as expired. */
export function toQuotationView(id: string, q: QuotationDoc): QuotationView {
  const expired = q.status === "submitted" && q.validUntil && isPastDeadline(q.validUntil);
  return {
    id,
    status: expired ? "expired" : q.status,
    version: q.version,
    mode: q.mode,
    technicianId: q.technicianId,
    inspectionFindings: q.inspectionFindings ?? null,
    lineItems: q.lineItems,
    labourLkr: q.labourLkr,
    materialsLkr: q.materialsLkr,
    additionalLkr: q.additionalLkr,
    inspectionFeeLkr: q.inspectionFeeLkr,
    totalLkr: q.totalLkr,
    estimatedDurationHours: q.estimatedDurationHours,
    exclusions: q.exclusions ?? null,
    assumptions: q.assumptions ?? null,
    notes: q.notes,
    revisionOfQuotationId: q.revisionOfQuotationId ?? null,
    revisionReason: q.revisionReason ?? null,
    differences: q.differences ?? null,
    decisionReason: q.decisionReason ?? null,
    createdAt: iso(q.createdAt)!,
    validUntil: iso(q.validUntil) ?? iso(q.createdAt)!,
    decidedAt: iso(q.decidedAt),
    acceptedAt: iso(q.acceptedAt),
  };
}

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
  const snap = await refs
    .bookings()
    .where("technicianId", "==", technicianUid)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => toSummary(d.id, d.data() as BookingDoc));
}

/** The booking for one of its participants (or an admin); null for anyone else. */
export async function getBookingView(viewer: Actor, bookingId: string): Promise<BookingView | null> {
  const snap = await refs.booking(bookingId).get();
  if (!snap.exists) return null;
  const booking = snap.data() as BookingDoc;
  const allowed =
    viewer.role === "admin" ||
    (viewer.role === "customer" && booking.customerId === viewer.uid) ||
    (viewer.role === "technician" && booking.technicianId === viewer.uid);
  if (!allowed) return null;

  const [quotationSnap, historySnap, techSnap, paymentSnap] = await Promise.all([
    refs.quotations().where("bookingId", "==", bookingId).get(),
    refs.bookingHistory(bookingId).orderBy("at", "asc").get(),
    refs.technician(booking.technicianId).get(),
    refs.payment(bookingId).get(),
  ]);
  const quotations = quotationSnap.docs
    .map((d) => toQuotationView(d.id, d.data() as QuotationDoc))
    .sort((a, b) => b.version - a.version);

  const active = !["completed", "cancelled"].includes(booking.status);
  const role = viewer.role;
  const current = quotations.find((q) => q.id === booking.currentQuotationId);
  const can = (to: BookingStatus) => canTransition(bookingTransitions, booking.status, to, role, booking.mode);
  const payment = paymentSnap.data() as PaymentDoc | undefined;

  return {
    ...toSummary(snap.id, booking),
    customerId: booking.customerId,
    technicianId: booking.technicianId,
    etaMinutes: booking.etaMinutes,
    scheduledVisit: booking.scheduledVisit ?? null,
    technicianMessage: booking.technicianMessage,
    visitConfirmedAt: iso(booking.visitConfirmedAt),
    enRouteAt: iso(booking.enRouteAt),
    arrivedAt: iso(booking.arrivedAt),
    confirmedAt: iso(booking.confirmedAt),
    workStartedAt: iso(booking.workStartedAt),
    completedAt: iso(booking.completedAt),
    quotationCount: booking.quotationCount,
    acceptedQuotationId: booking.acceptedQuotationId,
    conversationId: booking.conversationId ?? null,
    cancellation: booking.cancellation
      ? {
          by: booking.cancellation.by,
          reason: booking.cancellation.reason,
          fromStatus: booking.cancellation.fromStatus,
          inspectionFeeDue: booking.cancellation.inspectionFeeDue,
          at: iso(booking.cancellation.at)!,
        }
      : null,
    payment: payment
      ? {
          status: payment.status,
          visitFeeLkr: payment.visitFeeLkr,
          repairChargesLkr: payment.repairChargesLkr,
          totalDueLkr: payment.totalDueLkr,
        }
      : null,
    technician: techSnap.exists ? toTechnicianView(techSnap.id, techSnap.data() as TechnicianDoc, active) : null,
    quotations,
    history: historySnap.docs.map((d) => {
      const e = d.data() as BookingStatusEventDoc;
      return { from: e.from, to: e.to, actorRole: e.actorRole, note: e.note, at: iso(e.at)! };
    }),
    allowed: {
      steps: bookingSteps.filter((step) => {
        const def = stepDefinitions[step];
        if (def.role !== role || !can(def.to)) return false;
        return def.to !== "work_in_progress" || Boolean(booking.acceptedQuotationId);
      }),
      submitQuotation:
        role === "technician" && can("awaiting_customer_approval") && booking.quotationCount < MAX_QUOTATION_VERSIONS,
      quotationIsPriceChange: Boolean(booking.acceptedQuotationId),
      decideQuotationId:
        role === "customer" && booking.status === "awaiting_customer_approval" && current?.status === "submitted"
          ? current.id
          : null,
      cancel: can("cancelled") ? cancellationOutcome(booking.status, role, booking.inspectionFeeLkr) : null,
    },
  };
}

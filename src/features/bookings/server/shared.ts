import "server-only";

import {
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type Timestamp,
  type Transaction,
} from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { collections, subcollections } from "@/lib/firestore/collections";
import type {
  BookingDoc,
  BookingStatusEventDoc,
  ConversationDoc,
  PaymentDoc,
  QuotationDoc,
  ServiceRequestDoc,
  ServiceRequestEventDoc,
  TechnicianDoc,
} from "@/lib/firestore/models";
import { UserFacingError } from "@/lib/errors";

import type { VisitSlot } from "../schemas";
import { bookingTransitions, canTransition } from "../state-machine";
import { bookingStatusLabels, type BookingStatus, type ServiceRequestStatus } from "../types";
import type { TechnicianPublicView } from "../views";

/**
 * Building blocks shared by the Get Help Now and Get a Quote workflows. Every
 * write goes through a Firestore transaction with the actor taken from the
 * verified session; Security Rules deny these collections to clients.
 */
export type Actor = { uid: string; role: "customer" | "technician" | "admin" };

const db = () => adminDb();
export const refs = {
  request: (id: string) => db().collection(collections.serviceRequests).doc(id),
  requestHistory: (id: string) => refs.request(id).collection(subcollections.requestHistory),
  offers: (requestId: string) => refs.request(requestId).collection(subcollections.offers),
  offer: (requestId: string, technicianId: string) => refs.offers(requestId).doc(technicianId),
  technician: (uid: string) => db().collection(collections.technicians).doc(uid),
  bookings: () => db().collection(collections.bookings),
  booking: (id: string) => refs.bookings().doc(id),
  bookingHistory: (id: string) => refs.booking(id).collection(subcollections.statusHistory),
  quotations: () => db().collection(collections.quotations),
  quotation: (id: string) => refs.quotations().doc(id),
  payment: (bookingId: string) => db().collection(collections.payments).doc(bookingId),
  conversation: (id: string) => db().collection(collections.conversations).doc(id),
};

export const BOOKING_NOT_FOUND = "This job could not be found.";
export const REQUEST_GONE = "This request is no longer available.";

export const iso = (t: unknown) => (t as Timestamp | null | undefined)?.toDate().toISOString() ?? null;

export function recordBookingEvent(
  tx: Transaction,
  bookingId: string,
  from: BookingStatus | null,
  to: BookingStatus,
  actor: Actor | null,
  note: string | null = null,
) {
  tx.create(refs.bookingHistory(bookingId).doc(), {
    from,
    to,
    actorId: actor?.uid ?? "system",
    actorRole: actor?.role ?? "system",
    note,
    at: FieldValue.serverTimestamp(),
  } satisfies Record<keyof BookingStatusEventDoc, unknown>);
}

export function recordRequestEvent(
  tx: Transaction,
  requestId: string,
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
  actor: Actor | null,
  note: string | null = null,
) {
  tx.create(refs.requestHistory(requestId).doc(), {
    from,
    to,
    actorId: actor?.uid ?? null,
    actorRole: actor?.role ?? "system",
    note,
    at: FieldValue.serverTimestamp(),
  } satisfies Record<keyof ServiceRequestEventDoc, unknown>);
}

/** A friendly error instead of the raw state-machine message. */
export function assertBookingStep(booking: Pick<BookingDoc, "status" | "mode">, to: BookingStatus, role: Actor["role"]) {
  if (!canTransition(bookingTransitions, booking.status, to, role, booking.mode)) {
    throw new UserFacingError(
      `This job is now "${bookingStatusLabels[booking.status].toLowerCase()}", so that step isn't available. Refresh to see the latest.`,
    );
  }
}

/** Only the booking's own customer or technician (or an admin) may touch it. */
export function requireParticipant(booking: BookingDoc | undefined, actor: Actor): BookingDoc {
  if (!booking) throw new UserFacingError(BOOKING_NOT_FOUND);
  const isParticipant =
    (actor.role === "customer" && booking.customerId === actor.uid) ||
    (actor.role === "technician" && booking.technicianId === actor.uid) ||
    actor.role === "admin";
  if (!isParticipant) throw new UserFacingError(BOOKING_NOT_FOUND);
  return booking;
}

// ── Conversations ───────────────────────────────────────────────────────────

/** One thread per request and responding technician, reused by the booking. */
export const conversationIdFor = (requestId: string, technicianId: string) => `${requestId}_${technicianId}`;

/** Creates the thread if the pre-read snapshot shows it missing; links a booking when given. */
export function writeConversation(
  tx: Transaction,
  existing: DocumentSnapshot,
  data: { requestId: string; customerId: string; technicianId: string; bookingId?: string },
) {
  if (!existing.exists) {
    tx.create(existing.ref, {
      participantIds: [data.customerId, data.technicianId],
      customerId: data.customerId,
      technicianId: data.technicianId,
      requestId: data.requestId,
      bookingId: data.bookingId ?? null,
      lastMessagePreview: null,
      lastMessageAt: null,
      createdAt: FieldValue.serverTimestamp(),
    } satisfies Record<keyof ConversationDoc, unknown>);
  } else if (data.bookingId) {
    tx.update(existing.ref, { bookingId: data.bookingId });
  }
}

// ── Bookings and payment records ────────────────────────────────────────────

/** The quotation accepted at booking time (Quote Online selection). */
type AcceptedAtCreation = { quotationId: string; quotation: Pick<QuotationDoc, "totalLkr" | "inspectionFeeLkr"> };

/** Creates the booking and its payment record together. */
export function createBooking(
  tx: Transaction,
  ref: DocumentReference,
  params: {
    requestId: string;
    request: ServiceRequestDoc;
    technicianId: string;
    status: BookingStatus;
    inspectionFeeLkr: number;
    etaMinutes?: number | null;
    technicianMessage?: string | null;
    scheduledVisit?: VisitSlot | null;
    visitConfirmed?: boolean;
    accepted?: AcceptedAtCreation;
    conversationId: string;
  },
) {
  const now = FieldValue.serverTimestamp();
  const { request, accepted } = params;
  tx.create(ref, {
    requestId: params.requestId,
    customerId: request.customerId,
    technicianId: params.technicianId,
    participantIds: [request.customerId, params.technicianId],
    mode: request.mode,
    categoryId: request.categoryId,
    status: params.status,
    summary: {
      title: request.title,
      serviceName: request.catalogue.serviceName,
      city: request.city,
      district: request.district,
    },
    inspectionFeeLkr: params.inspectionFeeLkr,
    scheduledVisit: params.scheduledVisit ?? null,
    etaMinutes: params.etaMinutes ?? null,
    technicianMessage: params.technicianMessage ?? null,
    visitConfirmedAt: params.visitConfirmed ? now : null,
    enRouteAt: null,
    arrivedAt: null,
    currentQuotationId: accepted?.quotationId ?? null,
    quotationCount: accepted ? 1 : 0,
    acceptedQuotationId: accepted?.quotationId ?? null,
    agreedTotalLkr: accepted?.quotation.totalLkr ?? null,
    confirmedAt: accepted ? now : null,
    workStartedAt: null,
    completedAt: null,
    cancellation: null,
    conversationId: params.conversationId,
    createdAt: now,
    updatedAt: now,
  } satisfies Record<keyof BookingDoc, unknown>);

  tx.create(refs.payment(ref.id), {
    bookingId: ref.id,
    requestId: params.requestId,
    customerId: request.customerId,
    technicianId: params.technicianId,
    participantIds: [request.customerId, params.technicianId],
    currency: "LKR",
    status: "awaiting_completion",
    visitFeeLkr: params.inspectionFeeLkr,
    repairChargesLkr: accepted ? accepted.quotation.totalLkr - accepted.quotation.inspectionFeeLkr : 0,
    totalDueLkr: accepted ? accepted.quotation.totalLkr : params.inspectionFeeLkr,
    basisQuotationId: accepted?.quotationId ?? null,
    collection: null,
    createdAt: now,
    updatedAt: now,
  } satisfies Record<keyof PaymentDoc, unknown>);
}

/** Payment record changes. `merge` keeps older bookings without a record working. */
export const paymentWrites = {
  accepted(tx: Transaction, bookingId: string, quotationId: string, q: Pick<QuotationDoc, "totalLkr" | "inspectionFeeLkr">) {
    tx.set(
      refs.payment(bookingId),
      {
        visitFeeLkr: q.inspectionFeeLkr,
        repairChargesLkr: q.totalLkr - q.inspectionFeeLkr,
        totalDueLkr: q.totalLkr,
        basisQuotationId: quotationId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
  completed(tx: Transaction, bookingId: string) {
    tx.set(refs.payment(bookingId), { status: "due", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  },
  cancelled(tx: Transaction, bookingId: string, feeDueLkr: number) {
    tx.set(
      refs.payment(bookingId),
      {
        status: feeDueLkr > 0 ? "due" : "void",
        repairChargesLkr: 0,
        totalDueLkr: feeDueLkr,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
};

// ── Technician profile as shown to customers ────────────────────────────────

export function toTechnicianView(uid: string, t: TechnicianDoc, showPhone: boolean): TechnicianPublicView {
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

/** Technician profiles by uid, for comparison screens. */
export async function loadTechnicianViews(uids: string[]): Promise<Map<string, TechnicianPublicView>> {
  const unique = [...new Set(uids)];
  if (unique.length === 0) return new Map();
  const snaps = await db().getAll(...unique.map((uid) => refs.technician(uid)));
  return new Map(
    snaps.filter((s) => s.exists).map((s) => [s.id, toTechnicianView(s.id, s.data() as TechnicianDoc, false)]),
  );
}

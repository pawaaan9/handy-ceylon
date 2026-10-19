import { z } from "zod";

/**
 * The three ways a customer can book:
 * - urgent:       "Get Help Now" — an available nearby technician accepts,
 *                 inspects, then quotes. Work starts only after approval.
 * - quote_visit:  "Get a Quote → Technician Visit" — technicians offer inspection
 *                 fees, customer picks one, technician inspects then quotes.
 * - quote_online: "Get a Quote → Quote Online" — technicians quote remotely from
 *                 photos/videos/measurements; customer compares and accepts one.
 */
export const bookingModes = ["urgent", "quote_visit", "quote_online"] as const;
export const bookingModeSchema = z.enum(bookingModes);
export type BookingMode = z.infer<typeof bookingModeSchema>;

/**
 * serviceRequests/{id}.status — the request before and around assignment.
 * "open" covers the spec's submitted / awaiting_technician stages: a request
 * is visible to eligible technicians from the moment it is saved.
 */
export const serviceRequestStatuses = [
  "open", // awaiting a technician
  "assigned", // a technician accepted; the booking carries the job status from here
  "cancelled", // withdrawn by the customer, or the job was cancelled
  "expired", // nobody accepted before expiresAt
] as const;
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

/** serviceRequests/{id}/offers/{technicianId}.status — one technician's response. */
export const offerStatuses = [
  "pending", // quote_visit: offer waiting for the customer's choice
  "selected", // this technician got the job (urgent: accepted first; visit: chosen by the customer)
  "not_selected", // quote_visit: customer chose someone else
  "declined", // technician passed on the request
  "withdrawn", // technician pulled out before arriving
  "expired",
] as const;
export type OfferStatus = (typeof offerStatuses)[number];

/** bookings/{id}.status — one technician's job for one request. */
export const bookingStatuses = [
  "technician_assigned", // accepted with an inspection fee + ETA; customer to confirm the visit
  "visit_scheduled", // customer confirmed the visit and its fee
  "en_route", // technician travelling
  "inspecting", // on site, inspecting
  "awaiting_customer_approval", // itemized quotation sent
  "quote_rejected", // customer asked for a revision; technician revises, or either side cancels
  "confirmed", // customer approved the quotation — the confirmed job
  "work_in_progress",
  "completed",
  "cancelled",
] as const;
export const bookingStatusSchema = z.enum(bookingStatuses);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const finishedBookingStatuses: readonly BookingStatus[] = ["completed", "cancelled"];

export const bookingStatusLabels: Record<BookingStatus, string> = {
  technician_assigned: "Technician assigned",
  visit_scheduled: "Visit confirmed",
  en_route: "Technician on the way",
  inspecting: "On site",
  awaiting_customer_approval: "Quotation awaiting approval",
  quote_rejected: "Revision requested",
  confirmed: "Job confirmed",
  work_in_progress: "Work in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** quotations/{id}.status */
export const quotationStatuses = [
  "submitted", // waiting for the customer
  "accepted", // the customer approved or selected it
  "revision_requested", // the customer asked the technician for a revised quotation
  "rejected", // the customer rejected it and closed the job
  "not_selected", // Quote Online: the customer chose another technician's quotation
  "withdrawn", // the technician withdrew it, or the job was cancelled before a decision
  "superseded", // replaced by a newer version (an accepted one keeps its acceptedAt)
  "expired", // validUntil passed before a decision
] as const;
export type QuotationStatus = (typeof quotationStatuses)[number];

export const quotationStatusLabels: Record<QuotationStatus, string> = {
  submitted: "Awaiting decision",
  accepted: "Accepted",
  revision_requested: "Revision requested",
  rejected: "Rejected",
  not_selected: "Not selected",
  withdrawn: "Withdrawn",
  superseded: "Replaced by a newer version",
  expired: "Expired",
};

/** Customer-facing names of the booking options, for headings and badges. */
export const bookingModeLabels: Record<BookingMode, string> = {
  urgent: "Get Help Now",
  quote_visit: "Technician Visit",
  quote_online: "Quote Online",
};

export const quotationLineKinds = ["labour", "materials", "additional"] as const;
export type QuotationLineKind = (typeof quotationLineKinds)[number];

export const quotationLineKindLabels: Record<QuotationLineKind, string> = {
  labour: "Labour",
  materials: "Materials",
  additional: "Additional charge",
};

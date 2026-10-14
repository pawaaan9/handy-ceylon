import { z } from "zod";

/**
 * The three ways a customer can book:
 * - urgent:       "Get Help Now" — nearby technicians accept, inspect, then quote.
 * - quote_visit:  "Get a Quote → Technician Visit" — technicians offer inspection
 *                 fees, customer picks one, technician inspects then quotes.
 * - quote_online: "Get a Quote → Quote Online" — technicians quote remotely from
 *                 photos/videos/measurements; customer compares and accepts one.
 */
export const bookingModes = ["urgent", "quote_visit", "quote_online"] as const;
export const bookingModeSchema = z.enum(bookingModes);
export type BookingMode = z.infer<typeof bookingModeSchema>;

/** serviceRequests/{id}.status — the customer's request before a booking exists. */
export const serviceRequestStatuses = [
  "open", // visible to matching technicians; collecting acceptances/offers/quotes
  "assigned", // a technician was assigned and a booking created
  "cancelled", // customer withdrew before assignment
  "expired", // nobody responded within the window
] as const;
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];

/** serviceRequests/{id}/offers/{technicianId}.status */
export const offerStatuses = [
  "pending",
  "selected",
  "declined", // customer chose another technician
  "withdrawn", // technician withdrew
  "expired",
] as const;
export type OfferStatus = (typeof offerStatuses)[number];

/** bookings/{id}.status — shared lifecycle; mode decides which edges apply. */
export const bookingStatuses = [
  "scheduled", // technician assigned; visit ASAP (urgent) or at agreed time
  "en_route",
  "on_site", // arrived; inspecting (visit modes) or confirming scope (online)
  "quotation_pending", // quotation submitted, awaiting customer decision
  "quotation_approved", // customer approved; work may begin
  "in_progress",
  "completed",
  "closed_without_work", // customer declined the on-site quotation
  "cancelled",
  "disputed",
] as const;
export const bookingStatusSchema = z.enum(bookingStatuses);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/** quotations/{id}.status */
export const quotationStatuses = [
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
  "superseded", // replaced by a revised version from the same technician
  "expired",
] as const;
export type QuotationStatus = (typeof quotationStatuses)[number];

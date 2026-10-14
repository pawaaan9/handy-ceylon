import type { Transition } from "@/lib/state-machine";

import type {
  BookingStatus,
  OfferStatus,
  QuotationStatus,
  ServiceRequestStatus,
} from "./types";

export {
  assertTransition,
  canTransition,
  nextStatuses,
  TransitionError,
  type TransitionActor,
} from "@/lib/state-machine";

const VISIT_MODES = ["urgent", "quote_visit"] as const;

export const serviceRequestTransitions: readonly Transition<ServiceRequestStatus>[] = [
  { from: "open", to: "assigned", actors: ["system"] },
  { from: "open", to: "cancelled", actors: ["customer", "admin"] },
  { from: "open", to: "expired", actors: ["system"] },
];

export const offerTransitions: readonly Transition<OfferStatus>[] = [
  { from: "pending", to: "selected", actors: ["customer"] },
  { from: "pending", to: "declined", actors: ["system"] },
  { from: "pending", to: "withdrawn", actors: ["technician"] },
  { from: "pending", to: "expired", actors: ["system"] },
];

export const quotationTransitions: readonly Transition<QuotationStatus>[] = [
  { from: "submitted", to: "accepted", actors: ["customer"] },
  { from: "submitted", to: "rejected", actors: ["customer", "system"] },
  { from: "submitted", to: "withdrawn", actors: ["technician"] },
  { from: "submitted", to: "superseded", actors: ["system"] },
  { from: "submitted", to: "expired", actors: ["system"] },
];

const CANCELLERS = ["customer", "technician", "admin"] as const;

export const bookingTransitions: readonly Transition<BookingStatus>[] = [
  { from: "scheduled", to: "en_route", actors: ["technician"] },
  { from: "scheduled", to: "cancelled", actors: CANCELLERS },
  { from: "en_route", to: "on_site", actors: ["technician"] },
  { from: "en_route", to: "cancelled", actors: CANCELLERS },

  // Visit modes: inspect, then quote.
  { from: "on_site", to: "quotation_pending", actors: ["technician"], modes: VISIT_MODES },
  // Online mode: the accepted quotation already covers the job...
  { from: "on_site", to: "in_progress", actors: ["technician"], modes: ["quote_online"] },
  // ...unless the scope differs on site, in which case a revised quotation is required.
  { from: "on_site", to: "quotation_pending", actors: ["technician"], modes: ["quote_online"] },
  { from: "on_site", to: "cancelled", actors: ["admin"] },

  { from: "quotation_pending", to: "quotation_approved", actors: ["customer"] },
  { from: "quotation_pending", to: "closed_without_work", actors: ["customer"] },
  { from: "quotation_pending", to: "cancelled", actors: ["admin"] },
  { from: "quotation_approved", to: "in_progress", actors: ["technician"] },
  { from: "quotation_approved", to: "cancelled", actors: ["admin"] },
  { from: "in_progress", to: "completed", actors: ["technician"] },
  { from: "in_progress", to: "disputed", actors: ["customer", "technician"] },
  { from: "completed", to: "disputed", actors: ["customer"] },
  { from: "disputed", to: "completed", actors: ["admin"] },
  { from: "disputed", to: "cancelled", actors: ["admin"] },
];

export const terminalBookingStatuses: readonly BookingStatus[] = [
  "closed_without_work",
  "cancelled",
];

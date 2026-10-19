import type { Transition } from "@/lib/state-machine";

import type { BookingStatus, OfferStatus, QuotationStatus, ServiceRequestStatus } from "./types";

export {
  assertTransition,
  canTransition,
  nextStatuses,
  TransitionError,
  type TransitionActor,
} from "@/lib/state-machine";

export const serviceRequestTransitions: readonly Transition<ServiceRequestStatus>[] = [
  // A technician accepting is applied by the server inside one transaction.
  { from: "open", to: "assigned", actors: ["technician"] },
  { from: "open", to: "cancelled", actors: ["customer", "admin"] },
  { from: "open", to: "expired", actors: ["system"] },
  // The assigned technician withdrew before arriving: the request reopens.
  { from: "assigned", to: "open", actors: ["technician"] },
  { from: "assigned", to: "expired", actors: ["technician"] }, // withdrew after the request window closed
  // The job was cancelled; the request closes with it.
  { from: "assigned", to: "cancelled", actors: ["customer", "technician", "admin"] },
];

export const offerTransitions: readonly Transition<OfferStatus>[] = [
  { from: "pending", to: "selected", actors: ["customer"] },
  { from: "pending", to: "not_selected", actors: ["system"] },
  { from: "pending", to: "withdrawn", actors: ["technician"] },
  { from: "pending", to: "expired", actors: ["system"] },
  { from: "selected", to: "withdrawn", actors: ["technician"] },
];

export const quotationTransitions: readonly Transition<QuotationStatus>[] = [
  { from: "submitted", to: "accepted", actors: ["customer"] },
  { from: "submitted", to: "rejected", actors: ["customer"] },
  { from: "submitted", to: "withdrawn", actors: ["customer", "technician", "admin"] },
  { from: "submitted", to: "superseded", actors: ["system"] },
  { from: "submitted", to: "expired", actors: ["system"] },
];

const ANYONE = ["customer", "technician", "admin"] as const;

/**
 * Get Help Now lifecycle. Paid work can only start from "confirmed", which
 * only the customer can reach by approving a quotation — urgency never skips it.
 */
export const bookingTransitions: readonly Transition<BookingStatus>[] = [
  { from: "technician_assigned", to: "visit_scheduled", actors: ["customer"] },
  { from: "technician_assigned", to: "cancelled", actors: ANYONE },

  { from: "visit_scheduled", to: "en_route", actors: ["technician"] },
  { from: "visit_scheduled", to: "cancelled", actors: ANYONE },

  { from: "en_route", to: "inspecting", actors: ["technician"] },
  { from: "en_route", to: "cancelled", actors: ANYONE },

  { from: "inspecting", to: "awaiting_customer_approval", actors: ["technician"] },
  { from: "inspecting", to: "cancelled", actors: ANYONE },

  { from: "awaiting_customer_approval", to: "confirmed", actors: ["customer"] },
  { from: "awaiting_customer_approval", to: "quote_rejected", actors: ["customer"] },
  { from: "awaiting_customer_approval", to: "cancelled", actors: ["customer", "admin"] },

  { from: "quote_rejected", to: "awaiting_customer_approval", actors: ["technician"] }, // revised quotation
  { from: "quote_rejected", to: "cancelled", actors: ANYONE },

  { from: "confirmed", to: "work_in_progress", actors: ["technician"] },
  { from: "confirmed", to: "cancelled", actors: ["customer", "admin"] },

  { from: "work_in_progress", to: "completed", actors: ["technician"] },
  { from: "work_in_progress", to: "cancelled", actors: ["admin"] },
];

/** Before arrival, a technician pulling out reopens the request for others. */
const REOPEN_ON_TECHNICIAN_CANCEL: readonly BookingStatus[] = ["technician_assigned", "visit_scheduled", "en_route"];
/** Once the technician has inspected, an agreed inspection fee is owed even if the job is cancelled. */
const INSPECTION_FEE_DUE: readonly BookingStatus[] = [
  "inspecting",
  "awaiting_customer_approval",
  "quote_rejected",
  "confirmed",
  "work_in_progress",
];

export type CancellationOutcome = { reopensRequest: boolean; inspectionFeeDue: boolean };

/**
 * What cancelling from `status` means; call only after the transition is allowed.
 * - The customer owes an agreed inspection fee once the inspection has happened.
 * - A technician who pulls out mid-inspection waives it; one who won't revise a
 *   rejected quotation still charges it (the inspection was done).
 * - Admin cancellations never set a fee; admins settle disputes separately.
 */
export function cancellationOutcome(
  status: BookingStatus,
  actor: "customer" | "technician" | "admin",
  inspectionFeeLkr: number,
): CancellationOutcome {
  const inspected = INSPECTION_FEE_DUE.includes(status);
  const feeApplies =
    actor === "customer" ? inspected : actor === "technician" ? inspected && status !== "inspecting" : false;
  return {
    reopensRequest: actor === "technician" && REOPEN_ON_TECHNICIAN_CANCEL.includes(status),
    inspectionFeeDue: inspectionFeeLkr > 0 && feeApplies,
  };
}

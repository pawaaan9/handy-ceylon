import type { UserRole } from "@/features/auth/roles";

import type {
  BookingMode,
  BookingStatus,
  OfferStatus,
  QuotationStatus,
  ServiceRequestStatus,
} from "./types";

/** "system" covers scheduled jobs and server-side side effects (e.g. expiry). */
export type TransitionActor = UserRole | "system";

type Transition<S extends string> = {
  from: S;
  to: S;
  actors: readonly TransitionActor[];
  /** Restrict an edge to specific booking modes; omitted = all modes. */
  modes?: readonly BookingMode[];
};

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

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

function findTransition<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  to: S,
  actor: TransitionActor,
  mode?: BookingMode,
): Transition<S> | undefined {
  return table.find(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.actors.includes(actor) &&
      (!t.modes || (mode !== undefined && t.modes.includes(mode))),
  );
}

export function canTransition<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  to: S,
  actor: TransitionActor,
  mode?: BookingMode,
): boolean {
  return findTransition(table, from, to, actor, mode) !== undefined;
}

/** Server code calls this before every status write. */
export function assertTransition<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  to: S,
  actor: TransitionActor,
  mode?: BookingMode,
): void {
  if (!canTransition(table, from, to, actor, mode)) {
    throw new TransitionError(`Cannot move from "${from}" to "${to}" as ${actor}.`);
  }
}

export function nextStatuses<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  actor: TransitionActor,
  mode?: BookingMode,
): S[] {
  return table
    .filter(
      (t) =>
        t.from === from &&
        t.actors.includes(actor) &&
        (!t.modes || (mode !== undefined && t.modes.includes(mode))),
    )
    .map((t) => t.to);
}

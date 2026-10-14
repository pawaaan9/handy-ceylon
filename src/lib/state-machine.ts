import type { UserRole } from "@/features/auth/roles";
import type { BookingMode } from "@/features/bookings/types";

/** "system" covers scheduled jobs and server-side side effects (e.g. expiry). */
export type TransitionActor = UserRole | "system" | "applicant";

export type Transition<S extends string> = {
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

function matches<S extends string>(
  t: Transition<S>,
  from: S,
  actor: TransitionActor,
  mode?: BookingMode,
): boolean {
  return (
    t.from === from &&
    t.actors.includes(actor) &&
    (!t.modes || (mode !== undefined && t.modes.includes(mode)))
  );
}

export function canTransition<S extends string>(
  table: readonly Transition<S>[],
  from: S,
  to: S,
  actor: TransitionActor,
  mode?: BookingMode,
): boolean {
  return table.some((t) => t.to === to && matches(t, from, actor, mode));
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
  return table.filter((t) => matches(t, from, actor, mode)).map((t) => t.to);
}

"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import {
  acceptUrgentRequestSchema,
  bookingStepSchema,
  cancelBookingSchema,
  decideQuotationSchema,
  quotationIdOnlySchema,
  requestIdOnlySchema,
  selectVisitOfferSchema,
  setAvailabilitySchema,
  submitQuotationSchema,
  submitRemoteQuotationSchema,
  submitVisitOfferSchema,
} from "../schemas";
import type { CancellationOutcome } from "../state-machine";
import {
  acceptUrgentRequest,
  cancelBooking,
  declineRequest,
  decideQuotation,
  runBookingStep,
  setAvailability,
  submitQuotation,
  type Actor,
} from "./repository";
import {
  selectRemoteQuotation,
  selectVisitOffer,
  submitRemoteQuotation,
  submitVisitOffer,
  withdrawRemoteQuotation,
  withdrawVisitOffer,
} from "./quotes";

/*
 * The acting user and their role always come from the session. Inputs are
 * re-validated here; the repository then checks that the user is a party to
 * the request or booking and that the state machine allows the step.
 */

function refresh() {
  revalidatePath("/customer", "layout");
  revalidatePath("/technician", "layout");
}

async function currentActor(): Promise<Actor> {
  const user = await requireActionUser(["customer", "technician", "admin"]);
  return { uid: user.uid, role: user.role as Actor["role"] };
}

export async function acceptUrgentRequestAction(values: unknown): Promise<ActionResult<{ bookingId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    const { bookingId } = await acceptUrgentRequest(user.uid, acceptUrgentRequestSchema.parse(values));
    refresh();
    return { bookingId };
  });
}

export async function declineRequestAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    await declineRequest(user.uid, requestIdOnlySchema.parse(values).requestId);
    refresh();
    return undefined;
  });
}

export async function setAvailabilityAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    await setAvailability(user.uid, setAvailabilitySchema.parse(values).availability);
    refresh();
    return undefined;
  });
}

export async function bookingStepAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await currentActor();
    const { bookingId, step } = bookingStepSchema.parse(values);
    await runBookingStep(actor, bookingId, step);
    refresh();
    return undefined;
  });
}

export async function submitQuotationAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    const { id } = await submitQuotation(user.uid, submitQuotationSchema.parse(values));
    refresh();
    return { id };
  });
}

export async function decideQuotationAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    await decideQuotation(user.uid, decideQuotationSchema.parse(values));
    refresh();
    return undefined;
  });
}

export async function cancelBookingAction(values: unknown): Promise<ActionResult<CancellationOutcome>> {
  return runAction(async () => {
    const actor = await currentActor();
    const outcome = await cancelBooking(actor, cancelBookingSchema.parse(values));
    refresh();
    return outcome;
  });
}

// ── Get a Quote ─────────────────────────────────────────────────────────────

export async function submitVisitOfferAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    await submitVisitOffer(user.uid, submitVisitOfferSchema.parse(values));
    refresh();
    return undefined;
  });
}

export async function withdrawVisitOfferAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    await withdrawVisitOffer(user.uid, requestIdOnlySchema.parse(values).requestId);
    refresh();
    return undefined;
  });
}

export async function selectVisitOfferAction(values: unknown): Promise<ActionResult<{ bookingId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const { bookingId } = await selectVisitOffer(user.uid, selectVisitOfferSchema.parse(values));
    refresh();
    return { bookingId };
  });
}

export async function submitRemoteQuotationAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    const { id } = await submitRemoteQuotation(user.uid, submitRemoteQuotationSchema.parse(values));
    refresh();
    return { id };
  });
}

export async function withdrawRemoteQuotationAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["technician"]);
    await withdrawRemoteQuotation(user.uid, quotationIdOnlySchema.parse(values).quotationId);
    refresh();
    return undefined;
  });
}

export async function selectRemoteQuotationAction(values: unknown): Promise<ActionResult<{ bookingId: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const { bookingId } = await selectRemoteQuotation(user.uid, quotationIdOnlySchema.parse(values).quotationId);
    refresh();
    return { bookingId };
  });
}

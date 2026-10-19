"use client";

import { CheckCircle2, Hammer, MapPinCheck, Navigation, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatLkr } from "@/lib/format";

import type { BookingStep } from "../schemas";
import { bookingStepAction, cancelBookingAction, decideQuotationAction } from "../server/actions";
import type { BookingView } from "../views";
import { QuotationForm } from "./quotation-form";

const stepButtons: Record<BookingStep, { label: string; icon: typeof Navigation }> = {
  confirm_visit: { label: "Confirm visit", icon: CheckCircle2 },
  start_travel: { label: "I'm on my way", icon: Navigation },
  arrive: { label: "I've arrived — start inspection", icon: MapPinCheck },
  start_work: { label: "Start work", icon: Hammer },
  complete_work: { label: "Mark job completed", icon: CheckCircle2 },
};

/**
 * Only the actions the server listed in `booking.allowed` are rendered, and
 * the server re-checks each one, so a stale page can't skip a step.
 */
export function BookingActions({ booking, audience }: { booking: BookingView; audience: "customer" | "technician" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const { allowed } = booking;

  function run(key: string, action: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      let result;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: "We couldn't reach Handy Ceylon. Check your connection and try again." };
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        if (result.fieldErrors?.reason) setReasonError(result.fieldErrors.reason);
        router.refresh();
        return;
      }
      setRejecting(false);
      router.refresh();
    });
  }

  const step = (s: BookingStep) => run(s, () => bookingStepAction({ bookingId: booking.id, step: s }));
  const otherSteps = allowed.steps.filter((s) => s !== "confirm_visit");

  return (
    <div className="space-y-4">
      {allowed.steps.includes("confirm_visit") ? (
        <div className="rounded-lg border border-primary/30 bg-brand-soft p-4">
          <p className="font-semibold text-foreground">
            {booking.inspectionFeeLkr > 0
              ? `Inspection fee: ${formatLkr(booking.inspectionFeeLkr)}`
              : "Free inspection — no visit fee"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.etaMinutes ? `The technician can arrive in about ${booking.etaMinutes} minutes. ` : ""}
            They&apos;ll inspect and send you an itemized quotation. No repair work starts until you approve it
            {booking.inspectionFeeLkr > 0 ? "; if you don't, you pay only the inspection fee" : ""}.
          </p>
          <Button className="mt-4" size="lg" disabled={pending} onClick={() => step("confirm_visit")}>
            {busy === "confirm_visit" ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
            )}
            {booking.inspectionFeeLkr > 0 ? `Confirm visit and ${formatLkr(booking.inspectionFeeLkr)} fee` : "Confirm visit"}
          </Button>
        </div>
      ) : null}

      {allowed.decideQuotationId ? (
        <div className="rounded-lg border border-urgent/30 bg-urgent-soft p-4">
          <p className="font-semibold text-foreground">Approve this quotation?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Approving confirms the job at {formatLkr(booking.quotations[0]?.totalLkr ?? 0)}. The technician starts
            work only after you approve.
          </p>
          {rejecting ? (
            <div className="mt-4 space-y-3">
              <Field data-invalid={Boolean(reasonError)}>
                <FieldLabel htmlFor="reject-reason">Why are you rejecting it?</FieldLabel>
                <Textarea
                  id="reject-reason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={Boolean(reasonError)}
                  placeholder="e.g. The materials cost seems high — can you use a local brand?"
                />
                {reasonError ? <FieldError>{reasonError}</FieldError> : null}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={pending}
                  onClick={() => {
                    setReasonError(null);
                    if (reason.trim().length < 5) {
                      setReasonError("Tell the technician why, so they can send a revised quotation");
                      return;
                    }
                    run("reject", () =>
                      decideQuotationAction({ quotationId: allowed.decideQuotationId, decision: "reject", reason }),
                    );
                  }}
                >
                  {busy === "reject" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                  Reject quotation
                </Button>
                <Button variant="ghost" size="lg" disabled={pending} onClick={() => setRejecting(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="lg"
                disabled={pending}
                onClick={() =>
                  run("approve", () =>
                    decideQuotationAction({ quotationId: allowed.decideQuotationId, decision: "approve", reason: "" }),
                  )
                }
              >
                {busy === "approve" ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <ThumbsUp data-icon="inline-start" aria-hidden="true" />
                )}
                Approve and confirm job
              </Button>
              <Button variant="outline" size="lg" disabled={pending} onClick={() => setRejecting(true)}>
                <ThumbsDown data-icon="inline-start" aria-hidden="true" />
                Reject
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {allowed.submitQuotation && audience === "technician" ? (
        <div className="rounded-lg border p-4">
          <p className="font-semibold text-foreground">
            {booking.status === "quote_rejected" ? "Send a revised quotation" : "Inspection findings and quotation"}
          </p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Itemize labour, materials and any additional charges. The agreed inspection fee
            {booking.inspectionFeeLkr > 0 ? ` (${formatLkr(booking.inspectionFeeLkr)})` : ""} is added automatically.
            Don&apos;t start repairs until the customer approves.
          </p>
          <QuotationForm bookingId={booking.id} inspectionFeeLkr={booking.inspectionFeeLkr} />
        </div>
      ) : null}

      {otherSteps.length > 0 || allowed.cancel ? (
        <div className="flex flex-wrap gap-2">
          {otherSteps.map((s) => {
            const { label, icon: Icon } = stepButtons[s];
            return (
              <Button key={s} size="lg" disabled={pending} onClick={() => step(s)}>
                {busy === s ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Icon data-icon="inline-start" aria-hidden="true" />}
                {label}
              </Button>
            );
          })}
          {allowed.cancel ? (
            <CancelBookingDialog
              booking={booking}
              audience={audience}
              disabled={pending}
              onCancelled={() => router.refresh()}
            />
          ) : null}
        </div>
      ) : null}

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

function CancelBookingDialog({
  booking,
  audience,
  disabled,
  onCancelled,
}: {
  booking: BookingView;
  audience: "customer" | "technician";
  disabled: boolean;
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const outcome = booking.allowed.cancel!;

  function confirm() {
    setError(null);
    if (reason.trim().length < 5) {
      setError("Tell us briefly why (at least 5 characters)");
      return;
    }
    startTransition(async () => {
      const result = await cancelBookingAction({ bookingId: booking.id, reason }).catch(() => ({
        ok: false as const,
        error: "We couldn't reach Handy Ceylon. Check your connection and try again.",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onCancelled();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="text-destructive hover:text-destructive" disabled={disabled}>
          <XCircle data-icon="inline-start" aria-hidden="true" />
          {audience === "technician" && outcome.reopensRequest ? "Withdraw from job" : "Cancel job"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {audience === "technician" && outcome.reopensRequest ? "Withdraw from this job?" : "Cancel this job?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {outcome.reopensRequest
              ? "The request reopens so another available technician can accept it."
              : "This closes the job and its request. It can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {outcome.inspectionFeeDue ? (
          <FormAlert tone="info">
            The inspection has been done, so the agreed inspection fee of {formatLkr(booking.inspectionFeeLkr)} is
            still due.
          </FormAlert>
        ) : null}
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="cancel-booking-reason">Reason</FieldLabel>
          <Textarea
            id="cancel-booking-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={Boolean(error)}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep job</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={confirm} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {audience === "technician" && outcome.reopensRequest ? "Withdraw" : "Cancel job"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

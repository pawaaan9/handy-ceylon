"use client";

import { CheckCircle2 } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { formatLkr } from "@/lib/format";

import type { VisitSlot } from "../schemas";
import { selectRemoteQuotationAction, selectVisitOfferAction } from "../server/actions";
import { formatVisitSlot } from "./visit-slot";

type Result = { ok: true } | { ok: false; error: string };

/** Shared confirm-then-select flow. The server re-checks everything in a transaction. */
function SelectDialog({
  trigger,
  title,
  description,
  confirmLabel,
  disabled,
  onConfirm,
}: {
  trigger: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  disabled?: boolean;
  onConfirm: () => Promise<Result>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm().catch(() => ({
        ok: false as const,
        error: "We couldn't reach Handy Ceylon. Check your connection and try again — you won't be booked twice.",
      }));
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button size="lg" disabled={disabled}>
          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Not yet</AlertDialogCancel>
          <Button disabled={pending} onClick={confirm} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Technician Visit: pick one of the technician's visit times, then select the offer. */
export function SelectOfferForm({
  requestId,
  technicianId,
  technicianName,
  proposedVisits,
  inspectionFeeLkr,
}: {
  requestId: string;
  technicianId: string;
  technicianName: string;
  proposedVisits: VisitSlot[];
  inspectionFeeLkr: number;
}) {
  const [visitIndex, setVisitIndex] = useState(0);
  const chosen = proposedVisits[visitIndex];
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-foreground">Visit times offered</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {proposedVisits.map((slot, i) => (
            <label
              key={`${slot.date}-${slot.timeSlot}`}
              className="flex cursor-pointer items-start gap-2 rounded-lg border bg-background p-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                name={`visit-${technicianId}`}
                checked={visitIndex === i}
                onChange={() => setVisitIndex(i)}
                className="mt-0.5 accent-primary"
              />
              {formatVisitSlot(slot)}
            </label>
          ))}
        </div>
      </fieldset>
      <SelectDialog
        trigger={`Choose ${technicianName}`}
        title={`Book a visit with ${technicianName}?`}
        confirmLabel="Book visit"
        description={
          <>
            <p>
              Visit: <strong>{chosen ? formatVisitSlot(chosen) : "—"}</strong>
            </p>
            <p>
              Visit fee:{" "}
              <strong>{inspectionFeeLkr > 0 ? formatLkr(inspectionFeeLkr) : "Free"}</strong>. This covers the visit
              and inspection only — repairs are quoted separately after the inspection, and nothing starts until you
              approve that quotation.
            </p>
            <p>Other technicians&apos; offers will be closed.</p>
          </>
        }
        onConfirm={async () => {
          const r = await selectVisitOfferAction({ requestId, technicianId, visitIndex });
          return r.ok ? { ok: true } : { ok: false, error: r.error };
        }}
      />
    </div>
  );
}

/** Quote Online: select one quotation, confirming the job at its price. */
export function SelectQuotationButton({
  quotationId,
  technicianName,
  totalLkr,
  disabled,
}: {
  quotationId: string;
  technicianName: string;
  totalLkr: number;
  disabled?: boolean;
}) {
  return (
    <SelectDialog
      trigger="Select this quotation"
      title={`Select ${technicianName}'s quotation?`}
      confirmLabel={`Confirm job at ${formatLkr(totalLkr)}`}
      disabled={disabled}
      description={
        <>
          <p>
            This confirms the job at <strong>{formatLkr(totalLkr)}</strong> for the scope described in the quotation.
          </p>
          <p>
            If the technician finds different conditions on site, they must send a revised quotation with a reason, and
            no extra paid work happens until you approve it.
          </p>
          <p>Other quotations will be closed.</p>
        </>
      }
      onConfirm={async () => {
        const r = await selectRemoteQuotationAction({ quotationId });
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      }}
    />
  );
}

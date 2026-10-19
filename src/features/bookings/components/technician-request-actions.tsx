"use client";

import { Plus, Power, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { timeSlotLabels, timeSlots, type TimeSlot } from "@/features/requests/types";
import { addDays, colomboToday } from "@/lib/dates";

import { MAX_INSPECTION_FEE_LKR, MAX_PROPOSED_VISITS, MAX_VISIT_DAYS_AHEAD, type VisitSlot } from "../schemas";
import {
  acceptUrgentRequestAction,
  declineRequestAction,
  setAvailabilityAction,
  submitVisitOfferAction,
  withdrawRemoteQuotationAction,
  withdrawVisitOfferAction,
} from "../server/actions";

/** Stored availability; only "online" technicians can accept urgent requests. */
export function AvailabilityToggle({ availability }: { availability: "online" | "offline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const online = availability === "online";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setAvailabilityAction({ availability: online ? "offline" : "online" }).catch(() => ({
        ok: false as const,
        error: "We couldn't reach Handy Ceylon. Try again.",
      }));
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn("size-2.5 rounded-full", online ? "bg-success" : "bg-muted-foreground/40")} aria-hidden="true" />
          {online ? "You're online for urgent jobs" : "You're offline"}
        </span>
        <Button
          type="button"
          size="lg"
          variant={online ? "outline" : "default"}
          onClick={toggle}
          disabled={pending}
          aria-pressed={online}
        >
          {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Power data-icon="inline-start" aria-hidden="true" />}
          {online ? "Go offline" : "Go online"}
        </Button>
      </div>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

const etaOptions = [15, 30, 45, 60, 90, 120, 180, 240];

/** Accept (with inspection fee and arrival time) or decline one urgent request. */
export function RequestResponseForm({ requestId, canAccept }: { requestId: string; canAccept: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [fee, setFee] = useState("0");
  const [eta, setEta] = useState("60");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function respond(kind: "accept" | "decline") {
    setError(null);
    setFieldErrors({});
    setBusy(kind);
    startTransition(async () => {
      let result;
      try {
        result =
          kind === "accept"
            ? await acceptUrgentRequestAction({ requestId, inspectionFeeLkr: fee, etaMinutes: eta, message })
            : await declineRequestAction({ requestId });
      } catch {
        result = { ok: false as const, error: "We couldn't reach Handy Ceylon. Check your connection and try again." };
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        router.refresh();
        return;
      }
      if (kind === "accept" && result.data && "bookingId" in result.data) {
        router.push(`/technician/jobs/${result.data.bookingId}?status=accepted`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_10rem_1fr]">
        <Field data-invalid={Boolean(fieldErrors.inspectionFeeLkr)}>
          <FieldLabel htmlFor={`fee-${requestId}`}>Inspection fee (LKR)</FieldLabel>
          <Input
            id={`fee-${requestId}`}
            inputMode="numeric"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={Boolean(fieldErrors.inspectionFeeLkr)}
            aria-describedby={`fee-hint-${requestId}`}
          />
          <FieldDescription id={`fee-hint-${requestId}`}>0 = free. Max {MAX_INSPECTION_FEE_LKR.toLocaleString("en-LK")}.</FieldDescription>
          {fieldErrors.inspectionFeeLkr ? <FieldError>{fieldErrors.inspectionFeeLkr}</FieldError> : null}
        </Field>
        <Field data-invalid={Boolean(fieldErrors.etaMinutes)}>
          <FieldLabel htmlFor={`eta-${requestId}`}>Can arrive in</FieldLabel>
          <NativeSelect id={`eta-${requestId}`} value={eta} onChange={(e) => setEta(e.target.value)}>
            {etaOptions.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
              </option>
            ))}
          </NativeSelect>
          {fieldErrors.etaMinutes ? <FieldError>{fieldErrors.etaMinutes}</FieldError> : null}
        </Field>
        <Field data-invalid={Boolean(fieldErrors.message)}>
          <FieldLabel htmlFor={`msg-${requestId}`}>
            Message <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id={`msg-${requestId}`}
            maxLength={300}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I'll bring a replacement trap"
          />
          {fieldErrors.message ? <FieldError>{fieldErrors.message}</FieldError> : null}
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        The customer sees your fee and arrival time before confirming the visit. Quote the repair only after
        inspecting, and don&apos;t start work until they approve it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" variant="urgent" disabled={pending || !canAccept} onClick={() => respond("accept")}>
          {busy === "accept" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Accept job
        </Button>
        <Button size="lg" variant="ghost" disabled={pending} onClick={() => respond("decline")}>
          {busy === "decline" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Decline
        </Button>
      </div>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

type Outcome = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const unreachable = { ok: false as const, error: "We couldn't reach Handy Ceylon. Check your connection and try again." };

/** Technician Visit: offer a visit fee (visit and inspection only) and up to three visit times. */
export function VisitOfferForm({
  requestId,
  existing,
}: {
  requestId: string;
  existing: { inspectionFeeLkr: number; proposedVisits: VisitSlot[]; message: string | null } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fee, setFee] = useState(String(existing?.inspectionFeeLkr ?? "0"));
  const [slots, setSlots] = useState<{ date: string; timeSlot: TimeSlot | "" }[]>(
    existing?.proposedVisits.length ? existing.proposedVisits : [{ date: "", timeSlot: "" }],
  );
  const [message, setMessage] = useState(existing?.message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const today = colomboToday();

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result: Outcome = await submitVisitOfferAction({
        requestId,
        inspectionFeeLkr: fee,
        proposedVisits: slots,
        message,
      }).catch(() => unreachable);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.refresh();
    });
  }

  const slotError = (i: number) => fieldErrors[`proposedVisits.${i}.date`] ?? fieldErrors[`proposedVisits.${i}.timeSlot`];

  return (
    <div className="space-y-5">
      <Field data-invalid={Boolean(fieldErrors.inspectionFeeLkr)} className="sm:max-w-56">
        <FieldLabel htmlFor="offer-fee">Visit fee (LKR)</FieldLabel>
        <Input id="offer-fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} aria-invalid={Boolean(fieldErrors.inspectionFeeLkr)} />
        <FieldDescription>
          Covers the visit and inspection only — quote repairs separately after inspecting. 0 = free, max{" "}
          {MAX_INSPECTION_FEE_LKR.toLocaleString("en-LK")}.
        </FieldDescription>
        {fieldErrors.inspectionFeeLkr ? <FieldError>{fieldErrors.inspectionFeeLkr}</FieldError> : null}
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">When can you visit?</legend>
        {slots.map((slot, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
            <div>
              <label htmlFor={`slot-date-${i}`} className="sr-only">Visit {i + 1} date</label>
              <Input
                id={`slot-date-${i}`}
                type="date"
                min={today}
                max={addDays(today, MAX_VISIT_DAYS_AHEAD)}
                value={slot.date}
                onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                aria-invalid={Boolean(slotError(i))}
              />
            </div>
            <div>
              <label htmlFor={`slot-time-${i}`} className="sr-only">Visit {i + 1} time</label>
              <NativeSelect
                id={`slot-time-${i}`}
                value={slot.timeSlot}
                onChange={(e) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, timeSlot: e.target.value as TimeSlot } : x)))}
              >
                <option value="" disabled>Select a time</option>
                {timeSlots.map((t) => (
                  <option key={t} value={t}>{timeSlotLabels[t]}</option>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={slots.length === 1}
              onClick={() => setSlots((s) => s.filter((_, j) => j !== i))}
              aria-label={`Remove visit time ${i + 1}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
            {slotError(i) ? <FieldError className="sm:col-span-3">{slotError(i)}</FieldError> : null}
          </div>
        ))}
        {fieldErrors.proposedVisits ? <FieldError>{fieldErrors.proposedVisits}</FieldError> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={slots.length >= MAX_PROPOSED_VISITS}
          onClick={() => setSlots((s) => [...s, { date: "", timeSlot: "" }])}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add another time
        </Button>
      </fieldset>

      <Field>
        <FieldLabel htmlFor="offer-msg">
          Message <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input id="offer-msg" maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I'll bring a moisture meter to check the wall" />
      </Field>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Button size="lg" disabled={pending} onClick={submit}>
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Send data-icon="inline-start" aria-hidden="true" />}
        {existing ? "Update offer" : "Send offer"}
      </Button>
    </div>
  );
}

/** Withdraw a pending visit offer or a pending online quotation. */
export function WithdrawResponseButton({ requestId, quotationId }: { requestId?: string; quotationId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="lg"
        className="text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result: Outcome = await (quotationId
              ? withdrawRemoteQuotationAction({ quotationId })
              : withdrawVisitOfferAction({ requestId })
            ).catch(() => unreachable);
            if (!result.ok) setError(result.error);
            router.refresh();
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Undo2 data-icon="inline-start" aria-hidden="true" />}
        {quotationId ? "Withdraw quotation" : "Withdraw offer"}
      </Button>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

/** Pass on a request so it leaves your list. */
export function DeclineRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result: Outcome = await declineRequestAction({ requestId }).catch(() => unreachable);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/technician/requests");
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Not for me
      </Button>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

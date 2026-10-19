"use client";

import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { MAX_INSPECTION_FEE_LKR } from "../schemas";
import { acceptUrgentRequestAction, declineUrgentRequestAction, setAvailabilityAction } from "../server/actions";

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
            : await declineUrgentRequestAction({ requestId });
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

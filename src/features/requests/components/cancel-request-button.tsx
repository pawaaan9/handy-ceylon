"use client";

import { XCircle } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { cancelServiceRequestAction } from "../server/actions";
import { cancellationReasonLabels, cancellationReasons, type CancellationReason } from "../types";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<CancellationReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function confirm() {
    setError(null);
    setFieldErrors({});
    if (!reason) {
      setFieldErrors({ reason: "Choose a reason" });
      return;
    }
    startTransition(async () => {
      const result = await cancelServiceRequestAction({ requestId, reason, note });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      router.replace(`/customer/requests/${requestId}?status=cancelled`);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="text-destructive hover:text-destructive">
          <XCircle data-icon="inline-start" aria-hidden="true" />
          Cancel request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Technicians will no longer see it. This can&apos;t be undone, but you can always create a new request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <Field data-invalid={Boolean(fieldErrors.reason)}>
            <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
            <NativeSelect
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              aria-invalid={Boolean(fieldErrors.reason)}
            >
              <option value="" disabled>
                Select a reason
              </option>
              {cancellationReasons.map((r) => (
                <option key={r} value={r}>
                  {cancellationReasonLabels[r]}
                </option>
              ))}
            </NativeSelect>
            {fieldErrors.reason ? <FieldError>{fieldErrors.reason}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.note)}>
            <FieldLabel htmlFor="cancel-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="cancel-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(fieldErrors.note)}
            />
            {fieldErrors.note ? <FieldError>{fieldErrors.note}</FieldError> : null}
          </Field>
          {error && !fieldErrors.reason ? <FormAlert tone="error">{error}</FormAlert> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep request</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={confirm} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Cancel request
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

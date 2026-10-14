"use client";

import { Check, Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reviewTechnicianApplicationAction } from "@/features/technicians/server/actions";
import type { TechnicianApplicationStatus } from "@/features/technicians/types";

type Decision = "under_review" | "approved" | "rejected";

/** Buttons are a convenience; the server re-checks admin role and transition. */
export function ApplicationReviewForm({
  applicantUid,
  allowed,
}: {
  applicantUid: string;
  allowed: TechnicianApplicationStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  function decide(decision: Decision) {
    setError(null);
    setReasonError(null);
    setActive(decision);
    startTransition(async () => {
      const result = await reviewTechnicianApplicationAction({
        applicantUid,
        decision,
        rejectionReason: decision === "rejected" ? reason : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setReasonError(result.fieldErrors?.rejectionReason ?? null);
        return;
      }
      setRejecting(false);
      router.refresh();
    });
  }

  if (allowed.length === 0) return null;

  return (
    <div className="space-y-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {rejecting ? (
        <div className="space-y-3">
          <Field data-invalid={Boolean(reasonError)}>
            <FieldLabel htmlFor="rejectionReason">Reason for not approving</FieldLabel>
            <Textarea
              id="rejectionReason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={Boolean(reasonError)}
            />
            <FieldDescription>The applicant sees this message and can resubmit.</FieldDescription>
            {reasonError ? <FieldError>{reasonError}</FieldError> : null}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="lg" disabled={pending} onClick={() => decide("rejected")}>
              {pending && active === "rejected" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              Confirm rejection
            </Button>
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowed.includes("approved") ? (
            <Button size="lg" disabled={pending} onClick={() => decide("approved")}>
              {pending && active === "approved" ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Check data-icon="inline-start" aria-hidden="true" />
              )}
              Approve
            </Button>
          ) : null}
          {allowed.includes("under_review") ? (
            <Button variant="outline" size="lg" disabled={pending} onClick={() => decide("under_review")}>
              {pending && active === "under_review" ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Eye data-icon="inline-start" aria-hidden="true" />
              )}
              Mark under review
            </Button>
          ) : null}
          {allowed.includes("rejected") ? (
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setRejecting(true)}>
              <X data-icon="inline-start" aria-hidden="true" />
              Reject
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

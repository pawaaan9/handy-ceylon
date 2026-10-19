"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatLkr } from "@/lib/format";

import { computeQuotationTotals } from "../quotation";
import {
  MAX_QUOTATION_LINES,
  quotationLineSchema,
  submitQuotationSchema,
  type SubmitQuotationFormValues,
  type SubmitQuotationInput,
} from "../schemas";
import { submitQuotationAction } from "../server/actions";
import { quotationLineKindLabels, quotationLineKinds } from "../types";

const emptyLine = { kind: "labour" as const, description: "", quantity: "1", unitPriceLkr: "" };

export function QuotationForm({ bookingId, inspectionFeeLkr }: { bookingId: string; inspectionFeeLkr: number }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // One key per form: a retried submit returns the same quotation instead of a new version.
  const [submissionKey] = useState(() => crypto.randomUUID());
  const form = useForm<SubmitQuotationFormValues, unknown, SubmitQuotationInput>({
    resolver: zodResolver(submitQuotationSchema),
    defaultValues: {
      bookingId,
      submissionKey,
      inspectionFindings: "",
      lineItems: [emptyLine],
      estimatedDurationHours: "",
      notes: "",
    },
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
  const lines = useWatch({ control: form.control, name: "lineItems" });

  // Live preview only; the server recomputes every amount from the items.
  const valid = (lines ?? []).flatMap((l) => {
    const parsed = quotationLineSchema.safeParse(l);
    return parsed.success ? [parsed.data] : [];
  });
  const totals = computeQuotationTotals(valid, inspectionFeeLkr);

  async function onSubmit() {
    setFormError(null);
    let result;
    try {
      result = await submitQuotationAction(form.getValues());
    } catch {
      result = {
        ok: false as const,
        error: "We couldn't reach Handy Ceylon. Check your connection and try again — it won't be sent twice.",
      };
    }
    if (!result.ok) {
      setFormError(result.error);
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as FieldPath<SubmitQuotationFormValues>, { message });
      }
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Controller
        control={form.control}
        name="inspectionFindings"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="q-findings">What did you find?</FieldLabel>
            <Textarea
              {...field}
              id="q-findings"
              rows={4}
              maxLength={2000}
              aria-invalid={fieldState.invalid}
              placeholder="The cause of the problem and what needs to be done."
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-foreground">Items</legend>
        {fields.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[9rem_1fr_5rem_8rem_auto] sm:items-start">
            <Controller
              control={form.control}
              name={`lineItems.${index}.kind`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`q-kind-${index}`} className="sm:sr-only">Type</FieldLabel>
                  <NativeSelect {...field} id={`q-kind-${index}`} aria-invalid={fieldState.invalid}>
                    {quotationLineKinds.map((k) => (
                      <option key={k} value={k}>
                        {quotationLineKindLabels[k]}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`lineItems.${index}.description`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`q-desc-${index}`} className="sm:sr-only">Description</FieldLabel>
                  <Input {...field} id={`q-desc-${index}`} maxLength={200} placeholder="e.g. Replace P-trap" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`lineItems.${index}.quantity`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`q-qty-${index}`} className="sm:sr-only">Quantity</FieldLabel>
                  <Input {...field} value={String(field.value ?? "")} id={`q-qty-${index}`} inputMode="numeric" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name={`lineItems.${index}.unitPriceLkr`}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`q-price-${index}`} className="sm:sr-only">Unit price (LKR)</FieldLabel>
                  <Input
                    {...field}
                    value={String(field.value ?? "")}
                    id={`q-price-${index}`}
                    inputMode="numeric"
                    placeholder="LKR"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              aria-label={`Remove item ${index + 1}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <FieldError errors={[form.formState.errors.lineItems?.root ?? form.formState.errors.lineItems]} />
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => append({ ...emptyLine, kind: "materials" })}
          disabled={fields.length >= MAX_QUOTATION_LINES}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add item
        </Button>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <Controller
          control={form.control}
          name="estimatedDurationHours"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="q-hours">
                Hours <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input {...field} value={String(field.value ?? "")} id="q-hours" inputMode="numeric" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="q-notes">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input {...field} value={field.value ?? ""} id="q-notes" maxLength={1000} placeholder="Warranty, brands, what's excluded" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>

      <dl className="ml-auto max-w-xs space-y-1 text-sm" aria-live="polite">
        <div className="flex justify-between text-muted-foreground"><dt>Labour</dt><dd className="tabular-nums">{formatLkr(totals.labourLkr)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Materials</dt><dd className="tabular-nums">{formatLkr(totals.materialsLkr)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Additional</dt><dd className="tabular-nums">{formatLkr(totals.additionalLkr)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Inspection fee</dt><dd className="tabular-nums">{formatLkr(inspectionFeeLkr)}</dd></div>
        <div className="flex justify-between border-t pt-1.5 font-semibold text-foreground"><dt>Total</dt><dd className="tabular-nums">{formatLkr(totals.totalLkr)}</dd></div>
      </dl>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <div className="flex justify-end">
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Sending…">
          <Send data-icon="inline-start" aria-hidden="true" />
          Send quotation
        </SubmitButton>
      </div>
    </form>
  );
}

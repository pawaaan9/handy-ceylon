"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatLkr } from "@/lib/format";

import { computeQuotationTotals } from "../quotation";
import {
  MAX_QUOTATION_LINES,
  MAX_QUOTE_VALID_DAYS,
  quotationLineSchema,
  submitQuotationSchema,
  submitRemoteQuotationSchema,
  type SubmitQuotationFormValues,
  type SubmitQuotationInput,
  type SubmitRemoteQuotationFormValues,
  type SubmitRemoteQuotationInput,
} from "../schemas";
import { submitQuotationAction, submitRemoteQuotationAction } from "../server/actions";
import { quotationLineKindLabels, quotationLineKinds, type QuotationLineKind } from "../types";

type LineValue = { kind: QuotationLineKind; description: string; quantity: string | number; unitPriceLkr: string | number };
type LineItemsValues = { lineItems: LineValue[] };

const emptyLine: LineValue = { kind: "labour", description: "", quantity: "1", unitPriceLkr: "" };

/** Itemized labour / materials / additional lines, shared by both quotation forms. */
function LineItemsEditor({ control, idPrefix }: { control: Control<LineItemsValues>; idPrefix: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-foreground">Items</legend>
      {fields.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[9rem_1fr_5rem_8rem_auto] sm:items-start">
          <Controller
            control={control}
            name={`lineItems.${index}.kind`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${idPrefix}-kind-${index}`} className="sm:sr-only">Type</FieldLabel>
                <NativeSelect {...field} id={`${idPrefix}-kind-${index}`} aria-invalid={fieldState.invalid}>
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
            control={control}
            name={`lineItems.${index}.description`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${idPrefix}-desc-${index}`} className="sm:sr-only">Description</FieldLabel>
                <Input {...field} id={`${idPrefix}-desc-${index}`} maxLength={200} placeholder="e.g. Replace P-trap" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name={`lineItems.${index}.quantity`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${idPrefix}-qty-${index}`} className="sm:sr-only">Quantity</FieldLabel>
                <Input {...field} value={String(field.value ?? "")} id={`${idPrefix}-qty-${index}`} inputMode="numeric" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name={`lineItems.${index}.unitPriceLkr`}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${idPrefix}-price-${index}`} className="sm:sr-only">Unit price (LKR)</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value ?? "")}
                  id={`${idPrefix}-price-${index}`}
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
      <Controller
        control={control}
        name="lineItems"
        render={({ fieldState }) => <FieldError errors={[fieldState.error?.root ?? fieldState.error]} />}
      />
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
  );
}

/** Live preview only; the server recomputes every amount from the items. */
function TotalsPreview({ control, visitFeeLkr, visitFeeLabel }: { control: Control<LineItemsValues>; visitFeeLkr: number; visitFeeLabel: string | null }) {
  const lines = useWatch({ control, name: "lineItems" });
  const valid = (lines ?? []).flatMap((l) => {
    const parsed = quotationLineSchema.safeParse(l);
    return parsed.success ? [parsed.data] : [];
  });
  const t = computeQuotationTotals(valid, visitFeeLkr);
  const row = (label: string, value: number, strong = false) => (
    <div className={strong ? "flex justify-between border-t pt-1.5 font-semibold text-foreground" : "flex justify-between text-muted-foreground"}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatLkr(value)}</dd>
    </div>
  );
  return (
    <dl className="ml-auto max-w-xs space-y-1 text-sm" aria-live="polite">
      {row("Labour", t.labourLkr)}
      {row("Materials", t.materialsLkr)}
      {row("Additional", t.additionalLkr)}
      {row("Repair charges", t.labourLkr + t.materialsLkr + t.additionalLkr, true)}
      {visitFeeLabel ? row(visitFeeLabel, visitFeeLkr) : null}
      {row("Total", t.totalLkr, true)}
    </dl>
  );
}

function applyErrors<T extends FieldValues>(
  setError: (name: FieldPath<T>, error: { message: string }) => void,
  fieldErrors: Record<string, string> | undefined,
) {
  for (const [name, message] of Object.entries(fieldErrors ?? {})) setError(name as FieldPath<T>, { message });
}

const offline = "We couldn't reach Handy Ceylon. Check your connection and try again — it won't be sent twice.";

/** On-site quotation for a booking: the first after inspection, a requested revision, or a price change. */
export function QuotationForm({
  bookingId,
  inspectionFeeLkr,
  priceChange,
}: {
  bookingId: string;
  inspectionFeeLkr: number;
  /** Revising an accepted quotation: a reason is required. */
  priceChange: boolean;
}) {
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
      revisionReason: "",
    },
    mode: "onTouched",
  });
  const lineControl = form.control as unknown as Control<LineItemsValues>;

  async function onSubmit() {
    setFormError(null);
    if (priceChange && (form.getValues("revisionReason") ?? "").trim().length < 5) {
      form.setError("revisionReason", { message: "Explain the change (at least 5 characters)" });
      return;
    }
    const result = await submitQuotationAction(form.getValues()).catch(() => ({ ok: false as const, error: offline, fieldErrors: undefined }));
    if (!result.ok) {
      setFormError(result.error);
      applyErrors<SubmitQuotationFormValues>(form.setError, result.fieldErrors);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      {priceChange ? (
        <Controller
          control={form.control}
          name="revisionReason"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="q-reason">Why is the price or scope changing?</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                id="q-reason"
                rows={3}
                maxLength={500}
                aria-invalid={fieldState.invalid}
                placeholder="e.g. The wall behind the tiles is damp and needs treating before re-tiling."
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      ) : null}
      <Controller
        control={form.control}
        name="inspectionFindings"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="q-findings">{priceChange ? "What did you find on site?" : "What did you find?"}</FieldLabel>
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

      <LineItemsEditor control={lineControl} idPrefix="q" />

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

      <TotalsPreview control={lineControl} visitFeeLkr={inspectionFeeLkr} visitFeeLabel={inspectionFeeLkr > 0 ? "Visit fee (agreed)" : null} />

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <div className="flex justify-end">
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Sending…">
          <Send data-icon="inline-start" aria-hidden="true" />
          {priceChange ? "Send revised quotation" : "Send quotation"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Quote Online: a remote, itemized quotation with timeline, exclusions and assumptions. */
export function RemoteQuotationForm({ requestId, isRevision }: { requestId: string; isRevision: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const form = useForm<SubmitRemoteQuotationFormValues, unknown, SubmitRemoteQuotationInput>({
    resolver: zodResolver(submitRemoteQuotationSchema),
    defaultValues: {
      requestId,
      submissionKey,
      lineItems: [emptyLine],
      estimatedDurationHours: "",
      exclusions: "",
      assumptions: "",
      notes: "",
      validForDays: "7",
    },
    mode: "onTouched",
  });
  const lineControl = form.control as unknown as Control<LineItemsValues>;

  async function onSubmit() {
    setFormError(null);
    const result = await submitRemoteQuotationAction(form.getValues()).catch(() => ({ ok: false as const, error: offline, fieldErrors: undefined }));
    if (!result.ok) {
      setFormError(result.error);
      applyErrors<SubmitRemoteQuotationFormValues>(form.setError, result.fieldErrors);
      return;
    }
    router.refresh();
  }

  const text = (name: "exclusions" | "assumptions", label: string, placeholder: string, hint: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`rq-${name}`}>{label}</FieldLabel>
          <Textarea {...field} value={field.value ?? ""} id={`rq-${name}`} rows={3} maxLength={1000} placeholder={placeholder} aria-invalid={fieldState.invalid} />
          <FieldDescription>{hint}</FieldDescription>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <LineItemsEditor control={lineControl} idPrefix="rq" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="estimatedDurationHours"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="rq-hours">Estimated hours of work</FieldLabel>
              <Input {...field} value={String(field.value ?? "")} id="rq-hours" inputMode="numeric" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="validForDays"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="rq-valid">Price valid for (days)</FieldLabel>
              <Input {...field} value={String(field.value ?? "")} id="rq-valid" inputMode="numeric" aria-invalid={fieldState.invalid} />
              <FieldDescription>Up to {MAX_QUOTE_VALID_DAYS} days. The customer can&apos;t select it after that.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
      {text("assumptions", "Assumptions", "e.g. Walls are sound plaster; furniture moved before we start", "What your price relies on. If the site differs, you'll need the customer's approval for a revised price.")}
      {text("exclusions", "Exclusions", "e.g. Ceiling, wall repairs, disposal of old tiles", "What the price doesn't cover.")}
      <Controller
        control={form.control}
        name="notes"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="rq-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input {...field} value={field.value ?? ""} id="rq-notes" maxLength={1000} placeholder="Warranty, brands, earliest start" aria-invalid={fieldState.invalid} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <TotalsPreview control={lineControl} visitFeeLkr={0} visitFeeLabel={null} />
      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <div className="flex justify-end">
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Sending…">
          <Send data-icon="inline-start" aria-hidden="true" />
          {isRevision ? "Replace my quotation" : "Send quotation"}
        </SubmitButton>
      </div>
    </form>
  );
}

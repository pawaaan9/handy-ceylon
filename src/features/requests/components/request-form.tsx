"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, MapPinPlus, Pencil, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AddressForm } from "@/features/addresses/components/address-form";
import { addressLines, formatPhone } from "@/features/addresses/format";
import { MAX_ADDRESSES, type AddressFormValues, type AddressView } from "@/features/addresses/schemas";
import type { BookingMode } from "@/features/bookings/types";
import type { ServiceView } from "@/features/catalogue/types";
import { deleteFile } from "@/lib/firebase/upload";
import { cn } from "@/lib/utils";

import { formatBytes, formatSchedule } from "../format";
import {
  addDays,
  attachmentKind,
  colomboToday,
  createServiceRequestSchema,
  requestStepSchemas,
  type CreateServiceRequestInput,
  type RequestStep,
  type ServiceRequestFormValues,
} from "../schemas";
import { createServiceRequestAction } from "../server/actions";
import {
  MAX_SCHEDULE_DAYS_AHEAD,
  requestTypeLabel,
  requestTypeOptions,
  timeSlotLabels,
  timeSlots,
  urgencyLevels,
  urgencyOptions,
  urgentModeUrgencies,
  type Urgency,
} from "../types";
import { AttachmentUploader } from "./attachment-uploader";

const steps: { id: RequestStep | "review"; title: string }[] = [
  { id: "service", title: "Service" },
  { id: "address", title: "Address" },
  { id: "details", title: "Details" },
  { id: "attachments", title: "Photos & videos" },
  { id: "review", title: "Review" },
];

const stepFields: Record<RequestStep, FieldPath<ServiceRequestFormValues>[]> = {
  service: ["mode", "categoryId", "serviceId"],
  address: ["addressId"],
  details: [
    "title",
    "description",
    "urgency",
    "timing",
    "preferredDate",
    "preferredTimeSlot",
    "accessInstructions",
    "measurements",
    "siteConditions",
  ],
  attachments: ["attachments"],
};

function stepOfField(name: string): number {
  const index = steps.findIndex((s) => s.id !== "review" && stepFields[s.id].some((f) => name.startsWith(f)));
  return index === -1 ? steps.length - 1 : index;
}

const DRAFT_VERSION = 1;
type Draft = { version: number; step: number; values: ServiceRequestFormValues; savedAt: string };
const draftKey = (uid: string) => `handy-ceylon:request-draft:${uid}`;

function readDraft(uid: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(uid));
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    return draft?.version === DRAFT_VERSION && draft.values?.submissionKey ? draft : null;
  } catch {
    return null;
  }
}

function writeDraft(uid: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(draftKey(uid), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(uid));
  } catch {
    // Private mode or full storage: the form still works, just without a saved draft.
  }
}

function emptyValues(initial: Initial): ServiceRequestFormValues {
  return {
    submissionKey: crypto.randomUUID(),
    mode: initial.mode ?? ("" as BookingMode),
    categoryId: initial.categoryId ?? "",
    serviceId: initial.serviceId ?? "",
    addressId: initial.addressId ?? "",
    title: "",
    description: "",
    urgency: "" as Urgency,
    timing: initial.mode === "urgent" ? "asap" : ("" as "asap"),
    preferredDate: "",
    preferredTimeSlot: "",
    accessInstructions: "",
    measurements: "",
    siteConditions: "",
    attachments: [],
  };
}

type Initial = { mode?: BookingMode; categoryId?: string; serviceId?: string; addressId?: string };

type Props = {
  uid: string;
  categories: { id: string; name: string }[];
  services: ServiceView[];
  addresses: AddressView[];
  newAddressDefaults: AddressFormValues;
  initial: Initial;
};

const noopSubscribe = () => () => {};

/** The draft lives in localStorage, so the form renders only in the browser. */
export function RequestForm(props: Props) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) {
    return (
      <div role="status" aria-label="Loading form" className="space-y-4">
        <div className="h-2 animate-pulse rounded-full bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  return <RequestFormSteps {...props} />;
}

/** Restores an unfinished request, dropping selections that are no longer available. */
function restoreDraft({ uid, categories, services, addresses }: Props) {
  const draft = readDraft(uid);
  if (!draft) return null;
  const values = { ...draft.values };
  if (!categories.some((c) => c.id === values.categoryId)) values.categoryId = "";
  if (!services.some((s) => s.id === values.serviceId && s.categoryId === values.categoryId)) values.serviceId = "";
  if (!addresses.some((a) => a.id === values.addressId)) values.addressId = "";
  return { values, step: Math.min(Math.max(draft.step, 0), steps.length - 1), savedAt: draft.savedAt };
}

function RequestFormSteps(props: Props) {
  const { uid, categories, services, addresses, newAddressDefaults, initial } = props;
  const router = useRouter();
  const [restored] = useState(() => restoreDraft(props));
  const [step, setStep] = useState(restored?.step ?? 0);
  const [formError, setFormError] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(restored?.savedAt ?? null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [defaultValues] = useState(() => restored?.values ?? emptyValues(initial));

  const form = useForm<ServiceRequestFormValues, unknown, CreateServiceRequestInput>({
    resolver: zodResolver(createServiceRequestSchema),
    defaultValues,
    mode: "onTouched",
  });
  const [mode, categoryId, serviceId, addressId, timing, attachments, submissionKey] = useWatch({
    control: form.control,
    name: ["mode", "categoryId", "serviceId", "addressId", "timing", "attachments", "submissionKey"],
  });

  // Save the draft as the customer types (including the submission key, so
  // uploaded files stay attached and a retry can't create a second request).
  const allValues = useWatch({ control: form.control });
  const { isDirty } = form.formState;
  useEffect(() => {
    if (submitting.current || (!isDirty && !restoredAt)) return;
    const timer = setTimeout(() => {
      writeDraft(uid, {
        version: DRAFT_VERSION,
        step,
        values: allValues as ServiceRequestFormValues,
        savedAt: new Date().toISOString(),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [allValues, isDirty, restoredAt, uid, step]);

  function goTo(next: number) {
    setStep(next);
    setFormError(null);
    const draft = readDraft(uid);
    if (draft) writeDraft(uid, { ...draft, step: next });
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  /** Runs one step's schema and shows its errors; returns whether it passed. */
  const validateStep = useCallback(
    (id: RequestStep): boolean => {
      form.clearErrors(stepFields[id]);
      const result = requestStepSchemas[id].safeParse(form.getValues());
      if (result.success) return true;
      const seen = new Set<string>();
      for (const issue of result.error.issues) {
        const name = issue.path.join(".") as FieldPath<ServiceRequestFormValues>;
        if (!name || seen.has(name)) continue;
        seen.add(name);
        form.setError(name, { message: issue.message }, { shouldFocus: seen.size === 1 });
      }
      return false;
    },
    [form],
  );

  function next() {
    const current = steps[step].id;
    if (current !== "review" && !validateStep(current)) return;
    goTo(step + 1);
  }

  function changeMode(value: BookingMode) {
    form.setValue("mode", value, { shouldDirty: true });
    form.clearErrors("mode");
    const urgency = form.getValues("urgency");
    if (value === "urgent") {
      form.setValue("timing", "asap");
      if (urgency && !urgentModeUrgencies.includes(urgency)) form.setValue("urgency", "" as Urgency);
    } else if (form.getValues("timing") === "asap") {
      form.setValue("timing", "" as "asap");
    }
  }

  function startOver() {
    for (const a of form.getValues("attachments")) {
      deleteFile(a.storagePath).catch(() => {});
    }
    writeDraft(uid, null);
    form.reset(emptyValues(initial));
    setRestoredAt(null);
    goTo(0);
  }

  async function submit() {
    if (submitting.current) return;
    setFormError(null);
    for (const [index, s] of steps.entries()) {
      if (s.id !== "review" && !validateStep(s.id)) {
        goTo(index);
        return;
      }
    }

    submitting.current = true;
    setPending(true);
    let result: Awaited<ReturnType<typeof createServiceRequestAction>>;
    try {
      result = await createServiceRequestAction(form.getValues());
    } catch {
      result = {
        ok: false,
        error: "We couldn't reach Handy Ceylon. Check your connection and try again — your request won't be sent twice.",
      };
    }

    if (!result.ok) {
      submitting.current = false;
      setPending(false);
      setFormError(result.error);
      const fieldErrors = Object.entries(result.fieldErrors ?? {});
      for (const [name, message] of fieldErrors) {
        form.setError(name as FieldPath<ServiceRequestFormValues>, { message });
      }
      if (fieldErrors.length > 0) goTo(stepOfField(fieldErrors[0][0]));
      return;
    }

    // Keep `pending` while navigating so the button can't be pressed again.
    writeDraft(uid, null);
    router.replace(`/customer/requests/${result.data.id}?status=created`);
  }

  const categoryServices = services.filter((s) => s.categoryId === categoryId);
  const selectedService = services.find((s) => s.id === serviceId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const today = colomboToday();
  const current = steps[step];

  return (
    <div className="space-y-6">
      <ol className="hidden gap-2 sm:flex" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.id} className="flex flex-1 flex-col gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} aria-hidden="true" />
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
              {s.title}
              {i < step ? <span className="sr-only"> (completed)</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {restoredAt ? (
        <FormAlert tone="info" title="We restored your unfinished request">
          <p>Pick up where you left off, or start again.</p>
          <Button type="button" variant="link" className="h-auto p-0" onClick={startOver}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Start over
          </Button>
        </FormAlert>
      ) : null}

      <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="request-step-title">
        <p className="text-sm font-medium text-muted-foreground">
          Step {step + 1} of {steps.length}
        </p>
        <h2
          id="request-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 scroll-mt-24 text-xl font-semibold text-foreground outline-none"
        >
          {stepHeadings[current.id]}
        </h2>

        <div className="mt-6">
          {current.id === "service" ? (
            <div className="space-y-8">
              <Controller
                control={form.control}
                name="mode"
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldLegend variant="label">How would you like to book?</FieldLegend>
                    <div className="grid gap-3 md:grid-cols-3">
                      {requestTypeOptions.map((option, i) => (
                        <ChoiceCard
                          key={option.mode}
                          name="request-mode"
                          checked={field.value === option.mode}
                          onSelect={() => changeMode(option.mode)}
                          inputRef={i === 0 ? field.ref : undefined}
                          invalid={fieldState.invalid}
                          eyebrow={option.group ?? "Urgent"}
                          title={option.label}
                          description={option.description}
                          tone={option.mode === "urgent" ? "urgent" : "primary"}
                        />
                      ))}
                    </div>
                    <FieldError errors={[fieldState.error]} />
                  </FieldSet>
                )}
              />

              <Controller
                control={form.control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="sm:max-w-sm">
                    <FieldLabel htmlFor="req-category">Service category</FieldLabel>
                    <NativeSelect
                      {...field}
                      id="req-category"
                      aria-invalid={fieldState.invalid}
                      onChange={(e) => {
                        field.onChange(e);
                        form.setValue("serviceId", "");
                      }}
                    >
                      <option value="" disabled>
                        Select a category
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {categoryId ? (
                <Controller
                  control={form.control}
                  name="serviceId"
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">Which service do you need?</FieldLegend>
                      {categoryServices.length === 0 ? (
                        <FormAlert tone="info">
                          No bookable services in {selectedCategory?.name ?? "this category"} yet. Please choose
                          another category.
                        </FormAlert>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {categoryServices.map((s, i) => (
                            <ChoiceCard
                              key={s.id}
                              name="request-service"
                              checked={field.value === s.id}
                              onSelect={() => {
                                field.onChange(s.id);
                                form.clearErrors("serviceId");
                              }}
                              inputRef={i === 0 ? field.ref : undefined}
                              invalid={fieldState.invalid}
                              title={s.name}
                              description={s.description}
                            />
                          ))}
                        </div>
                      )}
                      <FieldError errors={[fieldState.error]} />
                    </FieldSet>
                  )}
                />
              ) : null}
            </div>
          ) : null}

          {current.id === "address" ? (
            <div className="space-y-5">
              {addresses.length > 0 ? (
                <Controller
                  control={form.control}
                  name="addressId"
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">Saved addresses</FieldLegend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {addresses.map((a, i) => (
                          <ChoiceCard
                            key={a.id}
                            name="request-address"
                            checked={field.value === a.id}
                            onSelect={() => {
                              field.onChange(a.id);
                              form.clearErrors("addressId");
                            }}
                            inputRef={i === 0 ? field.ref : undefined}
                            invalid={fieldState.invalid}
                            eyebrow={a.isDefault ? "Default" : undefined}
                            title={a.label}
                            description={
                              <>
                                {addressLines(a).map((line) => (
                                  <span key={line} className="block">
                                    {line}
                                  </span>
                                ))}
                                <span className="mt-1 block">
                                  {a.recipientName} · {formatPhone(a.contactNumber)}
                                </span>
                              </>
                            }
                          />
                        ))}
                      </div>
                      <FieldError errors={[fieldState.error]} />
                    </FieldSet>
                  )}
                />
              ) : (
                <FormAlert tone="info">Add the address where the technician should come.</FormAlert>
              )}

              {addingAddress ? (
                <div className="rounded-xl border bg-sand/30 p-4 sm:p-5">
                  <h3 className="mb-5 font-semibold text-foreground">New address</h3>
                  <AddressForm
                    mode="create"
                    defaultValues={newAddressDefaults}
                    onSaved={(id) => {
                      setAddingAddress(false);
                      form.setValue("addressId", id);
                      form.clearErrors("addressId");
                      router.refresh();
                    }}
                    onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
                  />
                </div>
              ) : addresses.length < MAX_ADDRESSES ? (
                <Button type="button" variant="outline" size="lg" onClick={() => setAddingAddress(true)}>
                  <MapPinPlus data-icon="inline-start" aria-hidden="true" />
                  Add a new address
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You&apos;ve saved the maximum of {MAX_ADDRESSES} addresses.{" "}
                  <Link href="/customer/addresses" className="font-medium text-primary hover:underline">
                    Manage addresses
                  </Link>
                </p>
              )}
            </div>
          ) : null}

          {current.id === "details" ? (
            <div className="space-y-7">
              <Controller
                control={form.control}
                name="title"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="req-title">Job title</FieldLabel>
                    <Input
                      {...field}
                      id="req-title"
                      maxLength={100}
                      placeholder="e.g. Kitchen sink is leaking under the cabinet"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="req-description">Describe the problem</FieldLabel>
                    <Textarea
                      {...field}
                      id="req-description"
                      rows={5}
                      maxLength={2000}
                      aria-invalid={fieldState.invalid}
                      aria-describedby="req-description-hint"
                      placeholder="What's happening, when it started, what you've tried, and any brand or model details."
                    />
                    <FieldDescription id="req-description-hint">
                      {field.value.trim().length}/2000 characters · at least 20
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="urgency"
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldLegend variant="label">How urgent is it?</FieldLegend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {urgencyLevels
                        .filter((u) => mode !== "urgent" || urgentModeUrgencies.includes(u))
                        .map((u, i) => (
                          <ChoiceCard
                            key={u}
                            name="request-urgency"
                            checked={field.value === u}
                            onSelect={() => {
                              field.onChange(u);
                              form.clearErrors("urgency");
                            }}
                            inputRef={i === 0 ? field.ref : undefined}
                            invalid={fieldState.invalid}
                            title={urgencyOptions[u].label}
                            description={urgencyOptions[u].description}
                            tone={u === "emergency" ? "urgent" : "primary"}
                            compact
                          />
                        ))}
                    </div>
                    <FieldError errors={[fieldState.error]} />
                  </FieldSet>
                )}
              />

              {mode === "urgent" ? (
                <div>
                  <p className="text-sm font-medium text-foreground">Preferred time</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get Help Now visits are as soon as possible. You&apos;ll see the technician&apos;s arrival time
                    when they accept.
                  </p>
                </div>
              ) : (
                <Controller
                  control={form.control}
                  name="timing"
                  render={({ field, fieldState }) => (
                    <FieldSet data-invalid={fieldState.invalid}>
                      <FieldLegend variant="label">When would you like this done?</FieldLegend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ChoiceCard
                          name="request-timing"
                          checked={field.value === "scheduled"}
                          onSelect={() => {
                            field.onChange("scheduled");
                            form.clearErrors("timing");
                          }}
                          inputRef={field.ref}
                          invalid={fieldState.invalid}
                          title="On a preferred date"
                          description="Choose a day and time of day."
                          compact
                        />
                        <ChoiceCard
                          name="request-timing"
                          checked={field.value === "flexible"}
                          onSelect={() => {
                            field.onChange("flexible");
                            form.clearErrors(["timing", "preferredDate", "preferredTimeSlot"]);
                          }}
                          invalid={fieldState.invalid}
                          title="I'm flexible"
                          description="Any convenient time works."
                          compact
                        />
                      </div>
                      <FieldError errors={[fieldState.error]} />
                    </FieldSet>
                  )}
                />
              )}

              {mode !== "urgent" && timing === "scheduled" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="preferredDate"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="req-date">Preferred date</FieldLabel>
                        <Input
                          {...field}
                          id="req-date"
                          type="date"
                          min={today}
                          max={addDays(today, MAX_SCHEDULE_DAYS_AHEAD)}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="preferredTimeSlot"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="req-slot">Preferred time</FieldLabel>
                        <NativeSelect {...field} id="req-slot" aria-invalid={fieldState.invalid}>
                          <option value="" disabled>
                            Select a time
                          </option>
                          {timeSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {timeSlotLabels[slot]}
                            </option>
                          ))}
                        </NativeSelect>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                </div>
              ) : null}

              <Controller
                control={form.control}
                name="accessInstructions"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="req-access">
                      Access instructions <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      id="req-access"
                      rows={3}
                      maxLength={500}
                      aria-invalid={fieldState.invalid}
                      placeholder="Gate code, parking, pets, who will let the technician in"
                    />
                    <FieldDescription>Shared only with the technician assigned to this job.</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              {mode && mode !== "urgent" ? (
                <Controller
                  control={form.control}
                  name="siteConditions"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="req-site">
                        Site details for quoting <span className="font-normal text-muted-foreground">(optional)</span>
                      </FieldLabel>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        id="req-site"
                        rows={3}
                        maxLength={500}
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. 3rd-floor flat, no lift, street parking only, plastered brick walls"
                      />
                      <FieldDescription>
                        Visible to technicians who quote. Don&apos;t include gate codes — put those in access
                        instructions, which only your chosen technician sees.
                      </FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ) : null}

              {mode === "quote_online" ? (
                <Controller
                  control={form.control}
                  name="measurements"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="req-measurements">
                        Measurements <span className="font-normal text-muted-foreground">(optional)</span>
                      </FieldLabel>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        id="req-measurements"
                        rows={3}
                        maxLength={1000}
                        aria-invalid={fieldState.invalid}
                        placeholder="e.g. Living room walls 4.2 m × 2.7 m, two coats"
                      />
                      <FieldDescription>Sizes and quantities help technicians quote accurately.</FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              ) : null}
            </div>
          ) : null}

          {current.id === "attachments" ? (
            <Controller
              control={form.control}
              name="attachments"
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">
                    {mode === "quote_online" ? (
                      "Photos or videos of the job"
                    ) : (
                      <>
                        Photos or videos <span className="font-normal text-muted-foreground">(optional)</span>
                      </>
                    )}
                  </FieldLegend>
                  <FieldDescription id="req-attachments-hint">
                    {mode === "quote_online"
                      ? "Technicians price the job from these, so show the whole area and any damage clearly."
                      : "A quick photo helps the technician bring the right tools and parts."}
                  </FieldDescription>
                  <AttachmentUploader
                    uid={uid}
                    submissionKey={submissionKey}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      form.clearErrors("attachments");
                    }}
                    onBusyChange={setUploading}
                    invalid={fieldState.invalid}
                    describedBy="req-attachments-hint"
                  />
                  <FieldError errors={[fieldState.error]} />
                </FieldSet>
              )}
            />
          ) : null}

          {current.id === "review" ? (
            <div className="space-y-4">
              <ReviewSection title="Service" onEdit={() => goTo(0)}>
                <ReviewRow label="Booking type" value={mode ? requestTypeLabel(mode) : "—"} />
                <ReviewRow label="Category" value={selectedCategory?.name ?? "—"} />
                <ReviewRow label="Service" value={selectedService?.name ?? "—"} />
              </ReviewSection>
              <ReviewSection title="Address" onEdit={() => goTo(1)}>
                {selectedAddress ? (
                  <>
                    <ReviewRow label="Address" value={[selectedAddress.label, ...addressLines(selectedAddress)].join(", ")} />
                    <ReviewRow
                      label="Contact"
                      value={`${selectedAddress.recipientName} · ${formatPhone(selectedAddress.contactNumber)}`}
                    />
                  </>
                ) : (
                  <ReviewRow label="Address" value="—" />
                )}
              </ReviewSection>
              <ReviewSection title="Details" onEdit={() => goTo(2)}>
                <ReviewValues values={form.getValues()} />
              </ReviewSection>
              <ReviewSection title="Photos & videos" onEdit={() => goTo(3)}>
                <ReviewRow
                  label="Attached"
                  value={
                    attachments.length === 0
                      ? "None"
                      : attachments
                          .map(
                            (a) =>
                              `${a.name} (${attachmentKind(a.contentType) === "video" ? "video" : "photo"}, ${formatBytes(a.sizeBytes)})`,
                          )
                          .join(", ")
                  }
                />
              </ReviewSection>
              <p className="text-sm text-muted-foreground">
                Your exact address and access instructions are shared only with the technician you choose. You
                approve any price in LKR before work starts.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" size="xl" onClick={() => goTo(step - 1)} disabled={pending}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {current.id === "review" ? (
          <Button type="button" size="xl" onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? (
              <>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Sending request…
              </>
            ) : (
              <>
                <Send data-icon="inline-start" aria-hidden="true" />
                Submit request
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="xl"
            onClick={next}
            disabled={uploading || (current.id === "address" && addingAddress && addresses.length === 0)}
          >
            {uploading ? "Waiting for uploads…" : "Continue"}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

const stepHeadings: Record<RequestStep | "review", string> = {
  service: "What do you need help with?",
  address: "Where should the technician come?",
  details: "Tell us about the job",
  attachments: "Add photos or videos",
  review: "Check and submit your request",
};

function ChoiceCard({
  name,
  checked,
  onSelect,
  inputRef,
  invalid,
  eyebrow,
  title,
  description,
  tone = "primary",
  compact,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  tone?: "primary" | "urgent";
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border bg-background transition-colors hover:border-primary/40 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        compact ? "p-3.5" : "p-4",
        checked && (tone === "urgent" ? "border-urgent bg-urgent-soft" : "border-primary bg-brand-soft"),
        invalid && !checked && "border-destructive/50",
      )}
    >
      <input
        ref={inputRef}
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={cn("mt-0.5 size-4 shrink-0", tone === "urgent" ? "accent-urgent" : "accent-primary")}
      />
      <span className="min-w-0">
        {eyebrow ? (
          <span
            className={cn(
              "block text-xs font-semibold tracking-wide uppercase",
              tone === "urgent" ? "text-urgent" : "text-primary",
            )}
          >
            {eyebrow}
          </span>
        ) : null}
        <span className="block font-semibold text-foreground">{title}</span>
        {description ? <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
          <Pencil data-icon="inline-start" aria-hidden="true" />
          Edit
        </Button>
      </div>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words whitespace-pre-line text-foreground">{value}</dd>
    </div>
  );
}

function ReviewValues({ values }: { values: ServiceRequestFormValues }) {
  const schedule =
    values.timing === "scheduled" && values.preferredDate && values.preferredTimeSlot
      ? formatSchedule({ kind: "scheduled", date: values.preferredDate, timeSlot: values.preferredTimeSlot })
      : values.timing === "asap" || values.timing === "flexible"
        ? formatSchedule({ kind: values.timing })
        : "—";
  return (
    <>
      <ReviewRow label="Title" value={values.title || "—"} />
      <ReviewRow label="Description" value={values.description || "—"} />
      <ReviewRow label="Urgency" value={values.urgency ? urgencyOptions[values.urgency].label : "—"} />
      <ReviewRow label="Preferred time" value={schedule} />
      <ReviewRow label="Access instructions" value={values.accessInstructions || "None"} />
      {values.mode === "quote_online" ? (
        <ReviewRow label="Measurements" value={values.measurements || "None"} />
      ) : null}
      {values.mode && values.mode !== "urgent" ? (
        <ReviewRow label="Site details" value={values.siteConditions || "None"} />
      ) : null}
    </>
  );
}

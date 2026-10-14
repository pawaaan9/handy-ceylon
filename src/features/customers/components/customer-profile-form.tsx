"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  customerProfileSchema,
  type CustomerProfileFormValues,
  type CustomerProfileInput,
} from "../schemas";
import { updateCustomerProfileAction } from "../server/actions";

export function CustomerProfileForm({ defaultValues }: { defaultValues: CustomerProfileFormValues }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const form = useForm<CustomerProfileFormValues, unknown, CustomerProfileInput>({
    resolver: zodResolver(customerProfileSchema),
    defaultValues,
    mode: "onTouched",
  });

  async function onSubmit(values: CustomerProfileInput) {
    setStatus(null);
    const result = await updateCustomerProfileAction(values);
    if (!result.ok) {
      setStatus({ tone: "error", text: result.error });
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof CustomerProfileFormValues, { message });
      }
      return;
    }
    setStatus({ tone: "success", text: "Your profile has been saved." });
    form.reset(form.getValues());
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FieldSet>
        <FieldLegend>Contact details</FieldLegend>
        <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
          <Controller
            control={form.control}
            name="fullName"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <Input {...field} id="fullName" autoComplete="name" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="phoneNumber"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="phoneNumber">Mobile number</FieldLabel>
                <Input
                  {...field}
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      {status ? <FormAlert tone={status.tone}>{status.text}</FormAlert> : null}
      <div className="flex justify-end">
        <SubmitButton
          pending={form.formState.isSubmitting}
          pendingLabel="Saving…"
          disabled={!form.formState.isDirty}
          className="w-full sm:w-auto"
        >
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  completeProfileSchema,
  type CompleteProfileFormValues,
  type CompleteProfileInput,
} from "../schemas";
import { navigateAfterAuthChange } from "../client/session";
import { completeProfileAction } from "../server/actions";

export function CompleteProfileForm({ defaultName }: { defaultName: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CompleteProfileFormValues, unknown, CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: { fullName: defaultName, phoneNumber: "", acceptTerms: false },
    mode: "onTouched",
  });

  async function onSubmit(values: CompleteProfileInput) {
    setFormError(null);
    const result = await completeProfileAction(values);
    if (!result.ok) {
      setFormError(result.error);
      if (result.fieldErrors?.phoneNumber) {
        form.setError("phoneNumber", { message: result.fieldErrors.phoneNumber });
      }
      return;
    }
    navigateAfterAuthChange(result.data.redirectTo, { replace: true });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
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
                placeholder="077 123 4567"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptTerms"
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={fieldState.invalid}
                />
                <FieldLabel htmlFor="acceptTerms" className="leading-relaxed font-normal">
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="font-medium text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </FieldLabel>
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Saving…" className="w-full">
          Finish setting up
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

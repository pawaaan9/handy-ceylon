"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getFirebaseClient } from "@/lib/firebase/client";

import { authErrorCode, authErrorMessage } from "../client/errors";
import { continueUrl } from "../client/session";
import { authRoutes } from "../redirects";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas";

/** Errors that say nothing about whether the account exists. */
const reportableErrors = new Set([
  "auth/invalid-email",
  "auth/too-many-requests",
  "auth/network-request-failed",
]);

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  async function onSubmit({ email }: ForgotPasswordFormValues) {
    setFormError(null);
    try {
      await sendPasswordResetEmail(getFirebaseClient().auth, email, {
        url: continueUrl(authRoutes.login),
      });
    } catch (error) {
      const code = authErrorCode(error);
      if (code && reportableErrors.has(code)) {
        setFormError(authErrorMessage(error));
        return;
      }
      // Any other failure (e.g. unknown user) is reported as success to avoid
      // revealing which emails have accounts.
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <FormAlert tone="success" title="Check your email">
        If an account exists for <strong className="font-semibold">{sentTo}</strong>, we&apos;ve sent a
        link to reset your password. The link expires in 1 hour. Check your spam folder if you
        don&apos;t see it.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SubmitButton
          pending={form.formState.isSubmitting}
          pendingLabel="Sending link…"
          className="w-full"
        >
          Send reset link
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

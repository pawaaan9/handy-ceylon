"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isFirebaseClientConfigured } from "@/config/env.client";
import { getFirebaseClient } from "@/lib/firebase/client";

import { authErrorMessage } from "../client/errors";
import {
  establishServerSession,
  navigateAfterAuthChange,
  signInWithPassword,
} from "../client/session";
import { authRoutes } from "../redirects";
import { loginSchema, type LoginFormValues } from "../schemas";

export function LoginForm({ next, notice }: { next: string | null; notice?: string | null }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
    mode: "onTouched",
  });

  // This page only renders without a valid server session; clear any stale
  // browser sign-in so both sides agree.
  useEffect(() => {
    if (isFirebaseClientConfigured()) void signOut(getFirebaseClient().auth);
  }, []);

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const user = await signInWithPassword(values.email, values.password, values.remember);
      const result = await establishServerSession(user, values.remember, next);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      navigateAfterAuthChange(result.data.redirectTo, { replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  const pending =
    form.formState.isSubmitting || (form.formState.isSubmitSuccessful && !formError);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}
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

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href={authRoutes.forgotPassword}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                {...field}
                id="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="remember"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="remember"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <FieldLabel htmlFor="remember" className="font-normal">
                Keep me signed in for 14 days
              </FieldLabel>
            </Field>
          )}
        />

        <SubmitButton pending={pending} pendingLabel="Logging in…" className="w-full">
          Log in
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

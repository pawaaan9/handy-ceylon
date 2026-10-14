"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { sendEmailVerification } from "firebase/auth";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { authErrorMessage } from "../client/errors";
import {
  continueUrl,
  establishServerSession,
  navigateAfterAuthChange,
  signInWithPassword,
} from "../client/session";
import { authRoutes } from "../redirects";
import { signUpSchema, type SignUpFormValues, type SignUpInput } from "../schemas";
import { signUpAction } from "../server/actions";

const fieldNames = ["fullName", "email", "phoneNumber", "password", "confirmPassword", "acceptTerms"] as const;

export function SignUpForm({ next }: { next: string | null }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "creating" | "signing-in" | "done">("idle");
  const form = useForm<SignUpFormValues, unknown, SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
    mode: "onTouched",
  });

  async function onSubmit(values: SignUpInput) {
    setFormError(null);
    setStage("creating");
    const result = await signUpAction(values);
    if (!result.ok) {
      setStage("idle");
      setFormError(result.error);
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        if ((fieldNames as readonly string[]).includes(name)) {
          form.setError(name as (typeof fieldNames)[number], { message });
        }
      }
      return;
    }

    // Account exists now; sign in and start the session.
    setStage("signing-in");
    const verifyPath = next
      ? `${authRoutes.verifyEmail}?next=${encodeURIComponent(next)}`
      : authRoutes.verifyEmail;
    try {
      const user = await signInWithPassword(values.email, values.password, false);
      const session = await establishServerSession(user, false, next);
      if (!session.ok) throw new Error(session.error);
      await sendEmailVerification(user, { url: continueUrl(verifyPath) }).catch(() => {
        // Non-fatal: the verify page offers a resend button.
      });
      setStage("done");
      navigateAfterAuthChange(verifyPath, { replace: true });
    } catch (error) {
      setStage("idle");
      setFormError(
        `Your account was created, but we couldn't sign you in (${authErrorMessage(error)}). Please log in.`,
      );
    }
  }

  const pending = stage !== "idle";
  const pendingLabel = stage === "creating" ? "Creating account…" : "Signing you in…";

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
          name="phoneNumber"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="phoneNumber">Mobile number</FieldLabel>
              <Input
                {...field}
                id="phoneNumber"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="077 123 4567"
                aria-invalid={fieldState.invalid}
                aria-describedby="phoneNumber-hint"
              />
              <FieldDescription id="phoneNumber-hint">Sri Lankan mobile number.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                {...field}
                id="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby="password-hint"
              />
              <FieldDescription id="password-hint">
                At least 8 characters with uppercase, lowercase and a number.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <PasswordInput
                {...field}
                id="confirmPassword"
                autoComplete="new-password"
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
                  onBlur={field.onBlur}
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

        <SubmitButton pending={pending} pendingLabel={pendingLabel} className="w-full">
          Create account
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

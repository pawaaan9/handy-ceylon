"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EmailAuthProvider, linkWithCredential, sendEmailVerification } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { authErrorMessage } from "../client/errors";
import { continueUrl } from "../client/session";
import { authRoutes } from "../redirects";
import { linkEmailSchema, type LinkEmailFormValues } from "../schemas";
import { syncLinkedEmailAction } from "../server/actions";
import { useClientAuth } from "./firebase-auth-provider";

/**
 * Adds email + password sign-in to a mobile-only account (Firebase account
 * linking), then sends a verification email. The server copies the email
 * from Firebase Auth — never from this form.
 */
export function LinkEmailForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const clientAuth = useClientAuth();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const form = useForm<LinkEmailFormValues>({
    resolver: zodResolver(linkEmailSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: LinkEmailFormValues) {
    if (clientAuth.status !== "ready") return;
    setError(null);
    try {
      const email = values.email.trim().toLowerCase();
      const credential = EmailAuthProvider.credential(email, values.password);
      const { user } = await linkWithCredential(clientAuth.user, credential);
      const verifyPath = returnTo ? `${authRoutes.verifyEmail}?next=${encodeURIComponent(returnTo)}` : authRoutes.verifyEmail;
      await sendEmailVerification(user, { url: continueUrl(verifyPath) }).catch(() => {});
      const synced = await syncLinkedEmailAction();
      if (!synced.ok) throw new Error(synced.error);
      setDone(email);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && !(e as { code?: string }).code ? e.message : authErrorMessage(e));
    }
  }

  if (done) {
    return (
      <FormAlert tone="success" title="Email added">
        We sent a verification link to {done}. Open it to finish, then refresh this page.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        {clientAuth.status === "error" ? <FormAlert tone="error">{clientAuth.message}</FormAlert> : null}
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="link-email">Email address</FieldLabel>
              <Input {...field} id="link-email" type="email" autoComplete="email" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="link-password">Create a password</FieldLabel>
              <PasswordInput {...field} id="link-password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
              <FieldDescription>Lets you log in with email too. At least 8 characters with upper- and lowercase and a number.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="link-confirm">Confirm password</FieldLabel>
              <PasswordInput {...field} id="link-confirm" autoComplete="new-password" aria-invalid={fieldState.invalid} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SubmitButton
          pending={form.formState.isSubmitting}
          pendingLabel="Adding email…"
          disabled={clientAuth.status !== "ready"}
          className="w-full sm:w-auto"
        >
          Add email
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

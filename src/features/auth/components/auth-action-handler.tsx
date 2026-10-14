"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { getFirebaseClient } from "@/lib/firebase/client";

import { authErrorMessage } from "../client/errors";
import { authRoutes, safeNextPath } from "../redirects";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas";

type Props = { mode: string | null; oobCode: string | null; continueUrl: string | null };

const SLOW_MESSAGE = "This is taking longer than usual. Refresh the page to try again.";

/** Never leave the user on a spinner: give up waiting after 20 seconds. */
function withTimeout<T>(promise: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(SLOW_MESSAGE)), ms)),
  ]);
}

function messageFor(error: unknown): string {
  return error instanceof Error && error.message === SLOW_MESSAGE ? SLOW_MESSAGE : authErrorMessage(error);
}

/** Only same-origin continue URLs are followed. */
function sameOriginPath(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return safeNextPath(`${parsed.pathname}${parsed.search}`);
  } catch {
    return null;
  }
}

/**
 * Custom Firebase email action handler. Every code is verified with Firebase
 * before anything is shown or changed.
 */
export function AuthActionHandler({ mode, oobCode, continueUrl }: Props) {
  if (!oobCode || !mode) {
    return <InvalidLink message="This link is incomplete. Please request a new one." />;
  }
  switch (mode) {
    case "resetPassword":
      return <ResetPassword oobCode={oobCode} />;
    case "verifyEmail":
      return <VerifyEmail oobCode={oobCode} continueUrl={continueUrl} />;
    case "recoverEmail":
      return <RecoverEmail oobCode={oobCode} />;
    default:
      return <InvalidLink message="This link isn't supported. Please request a new one." />;
  }
}

function InvalidLink({ message }: { message: string }) {
  if (message === SLOW_MESSAGE) {
    return (
      <div className="space-y-5">
        <FormAlert tone="info" title="Still working on it">
          {message}
        </FormAlert>
        <Button size="xl" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <FormAlert tone="error" title="Link can't be used">
        {message}
      </FormAlert>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="xl" variant="outline" className="flex-1">
          <Link href={authRoutes.forgotPassword}>Reset password</Link>
        </Button>
        <Button asChild size="xl" className="flex-1">
          <Link href={authRoutes.login}>Log in</Link>
        </Button>
      </div>
    </div>
  );
}

function Checking({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" /> {label}
    </p>
  );
}

function ResetPassword({ oobCode }: { oobCode: string }) {
  const [state, setState] = useState<
    { step: "checking" } | { step: "form"; email: string } | { step: "done" } | { step: "invalid"; message: string }
  >({ step: "checking" });
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    withTimeout(verifyPasswordResetCode(getFirebaseClient().auth, oobCode))
      .then((email) => setState({ step: "form", email }))
      .catch((error) => setState({ step: "invalid", message: messageFor(error) }));
  }, [oobCode]);

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null);
    try {
      await confirmPasswordReset(getFirebaseClient().auth, oobCode, values.password);
      setState({ step: "done" });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  if (state.step === "checking") return <Checking label="Checking your reset link…" />;
  if (state.step === "invalid") return <InvalidLink message={state.message} />;
  if (state.step === "done") {
    return (
      <div className="space-y-5">
        <FormAlert tone="success" title="Password updated">
          You can now log in with your new password.
        </FormAlert>
        <Button asChild size="xl" className="w-full">
          <Link href={authRoutes.login}>Log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-5">
        <p className="text-sm text-muted-foreground">
          Choose a new password for <strong className="text-foreground">{state.email}</strong>.
        </p>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
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
              <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
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
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Saving…" className="w-full">
          Save new password
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}

function VerifyEmail({ oobCode, continueUrl }: { oobCode: string; continueUrl: string | null }) {
  const [state, setState] = useState<"checking" | "done" | { error: string }>("checking");

  useEffect(() => {
    const { auth } = getFirebaseClient();
    withTimeout(applyActionCode(auth, oobCode))
      .then(async () => {
        // Refresh the local user so the new verified state is visible at once.
        if (auth.currentUser) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
        }
        setState("done");
      })
      .catch((error) => setState({ error: messageFor(error) }));
  }, [oobCode, continueUrl]);

  if (state === "checking") return <Checking label="Verifying your email…" />;
  if (typeof state === "object") return <InvalidLink message={state.error} />;
  // Only reached after the client-side effect, so `window` is available.
  const next = sameOriginPath(continueUrl) ?? authRoutes.verifyEmail;
  return (
    <div className="space-y-5">
      <FormAlert tone="success" title="Email verified">
        Thanks — your email address is confirmed.
      </FormAlert>
      <Button asChild size="xl" className="w-full">
        <Link href={next}>Continue</Link>
      </Button>
    </div>
  );
}

function RecoverEmail({ oobCode }: { oobCode: string }) {
  const [state, setState] = useState<"checking" | { email: string } | { error: string }>("checking");

  useEffect(() => {
    const { auth } = getFirebaseClient();
    checkActionCode(auth, oobCode)
      .then(async (info) => {
        await applyActionCode(auth, oobCode);
        setState({ email: info.data.email ?? "your previous address" });
      })
      .catch((error) => setState({ error: authErrorMessage(error) }));
  }, [oobCode]);

  if (state === "checking") return <Checking label="Restoring your email address…" />;
  if ("error" in state) return <InvalidLink message={state.error} />;
  return (
    <div className="space-y-5">
      <FormAlert tone="success" title="Email address restored">
        Your sign-in email has been changed back to {state.email}. If you didn&apos;t request the
        change, reset your password now.
      </FormAlert>
      <Button asChild size="xl" className="w-full">
        <Link href={authRoutes.forgotPassword}>Reset password</Link>
      </Button>
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatLocalMobile } from "@/lib/format";

import { authErrorMessage } from "../client/errors";
import {
  createRecaptcha,
  establishServerSession,
  navigateAfterAuthChange,
  sendPhoneCode,
} from "../client/session";
import {
  otpSchema,
  phoneSignInSchema,
  type OtpFormValues,
  type PhoneSignInFormValues,
} from "../schemas";

const RESEND_SECONDS = 60;

/**
 * Mobile number sign-in / sign-up with an SMS one-time code. Firebase checks
 * the code; new numbers are taken to "complete profile" afterwards.
 */
export function PhoneAuthForm({ next, remember = false }: { next: string | null; remember?: boolean }) {
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sentTo, setSentTo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const phoneForm = useForm<PhoneSignInFormValues, unknown, { phoneNumber: string }>({
    resolver: zodResolver(phoneSignInSchema),
    defaultValues: { phoneNumber: "" },
    mode: "onTouched",
  });
  const codeForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => () => verifierRef.current?.clear(), []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(phoneNumber: string) {
    setError(null);
    try {
      verifierRef.current?.clear();
      verifierRef.current = createRecaptcha(recaptchaRef.current!);
      const result = await sendPhoneCode(phoneNumber, verifierRef.current, remember);
      setConfirmation(result);
      setSentTo(phoneNumber);
      setCooldown(RESEND_SECONDS);
      codeForm.reset({ code: "" });
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  async function verify({ code }: OtpFormValues) {
    if (!confirmation) return;
    setError(null);
    let user;
    try {
      user = (await confirmation.confirm(code)).user;
    } catch (e) {
      setError(authErrorMessage(e));
      return;
    }
    const session = await establishServerSession(user, remember, next);
    if (!session.ok) {
      setError(session.error);
      return;
    }
    navigateAfterAuthChange(session.data.redirectTo, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div ref={recaptchaRef} />
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {!confirmation ? (
        <form
          onSubmit={(event) => void phoneForm.handleSubmit(({ phoneNumber }) => sendCode(phoneNumber))(event)}
          noValidate
        >
          <FieldGroup className="gap-5">
            <Controller
              control={phoneForm.control}
              name="phoneNumber"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-lg border border-r-0 bg-muted px-3 text-sm font-medium text-muted-foreground">
                      🇱🇰 +94
                    </span>
                    <Input
                      {...field}
                      id="mobile"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="77 123 4567"
                      className="rounded-l-none"
                      aria-invalid={fieldState.invalid}
                      aria-describedby="mobile-hint"
                    />
                  </div>
                  <FieldDescription id="mobile-hint">We&apos;ll text you a 6-digit code. Standard SMS rates may apply.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <SubmitButton pending={phoneForm.formState.isSubmitting} pendingLabel="Sending code…" className="w-full">
              <MessageSquareText data-icon="inline-start" aria-hidden="true" />
              Send code
            </SubmitButton>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={(event) => void codeForm.handleSubmit(verify)(event)} noValidate>
          <FieldGroup className="gap-5">
            <p className="text-sm text-muted-foreground">
              Enter the code we sent to <strong className="text-foreground">{formatLocalMobile(sentTo)}</strong>.
            </p>
            <Controller
              control={codeForm.control}
              name="code"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="otp">Verification code</FieldLabel>
                  <Input
                    {...field}
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    className="h-12 text-center font-mono text-xl tracking-[0.5em]"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <SubmitButton pending={codeForm.formState.isSubmitting} pendingLabel="Verifying…" className="w-full">
              Verify and continue
            </SubmitButton>
            <div className="flex items-center justify-between text-sm">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmation(null)}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Change number
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={cooldown > 0}
                onClick={() => sendCode(sentTo)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </div>
  );
}

"use client";

import { sendEmailVerification } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { authErrorMessage } from "../client/errors";
import { continueUrl } from "../client/session";
import { authRoutes } from "../redirects";
import { useClientAuth } from "./firebase-auth-provider";

export function VerifyEmailPanel({ email, next }: { email: string; next: string | null }) {
  const router = useRouter();
  const clientAuth = useClientAuth();
  const [busy, setBusy] = useState<"resend" | "check" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  const ready = clientAuth.status === "ready";
  const verifyPath = next ? `${authRoutes.verifyEmail}?next=${encodeURIComponent(next)}` : authRoutes.verifyEmail;

  async function resend() {
    if (clientAuth.status !== "ready") return;
    setBusy("resend");
    setMessage(null);
    try {
      await sendEmailVerification(clientAuth.user, { url: continueUrl(verifyPath) });
      setMessage({ tone: "success", text: `We've sent a new verification link to ${email}.` });
    } catch (error) {
      setMessage({ tone: "error", text: authErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (clientAuth.status !== "ready") return;
    setBusy("check");
    setMessage(null);
    try {
      await clientAuth.user.reload();
      if (clientAuth.user.emailVerified) {
        await clientAuth.user.getIdToken(true);
        // The server re-checks Firebase Auth directly; refresh to show the result.
        router.refresh();
      } else {
        setMessage({
          tone: "info",
          text: "We haven't received your confirmation yet. Open the link in the email, then try again.",
        });
      }
    } catch (error) {
      setMessage({ tone: "error", text: authErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="leading-relaxed text-muted-foreground">
          We sent a verification link to <strong className="text-foreground">{email}</strong>. Open
          it on any device, then come back here.
        </p>
      </div>
      {clientAuth.status === "error" ? <FormAlert tone="error">{clientAuth.message}</FormAlert> : null}
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="xl" className="flex-1" onClick={check} disabled={!ready || busy !== null}>
          {busy === "check" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          I&apos;ve verified my email
        </Button>
        <Button size="xl" variant="outline" className="flex-1" onClick={resend} disabled={!ready || busy !== null}>
          {busy === "resend" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Resend email
        </Button>
      </div>
    </div>
  );
}

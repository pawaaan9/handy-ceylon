"use client";

import { useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { authErrorCode, authErrorMessage } from "../client/errors";
import { establishServerSession, navigateAfterAuthChange, signInWithGoogle } from "../client/session";

/** Google's "G" mark, as required by Google sign-in branding guidelines. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({
  label = "Continue with Google",
  next,
  remember = false,
}: {
  label?: string;
  next: string | null;
  remember?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    try {
      const user = await signInWithGoogle(remember);
      const result = await establishServerSession(user, remember, next);
      if (!result.ok) throw new Error(result.error);
      navigateAfterAuthChange(result.data.redirectTo, { replace: true });
    } catch (e) {
      setPending(false);
      const code = authErrorCode(e);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      setError(code ? authErrorMessage(e) : e instanceof Error ? e.message : authErrorMessage(e));
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="xl" className="w-full bg-background" onClick={onClick} disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <GoogleMark />}
        {label}
      </Button>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

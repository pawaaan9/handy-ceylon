"use client";

import { useState } from "react";

import { OrDivider } from "./auth-shell";
import { GoogleButton } from "./google-button";
import { MethodTabs, type AuthMethod } from "./method-tabs";
import { PhoneAuthForm } from "./phone-auth-form";
import { SignUpForm } from "./sign-up-form";

/** Register with email + password, a mobile number (SMS code) or Google. */
export function SignUpPanel({ next }: { next: string | null }) {
  const [method, setMethod] = useState<AuthMethod>("email");
  return (
    <div className="space-y-6">
      <GoogleButton label="Sign up with Google" next={next} />
      <OrDivider />
      <MethodTabs value={method} onChange={setMethod} />
      <div role="tabpanel" id={`panel-${method}`} aria-labelledby={`method-${method}`}>
        {method === "email" ? (
          <SignUpForm next={next} />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign up with just your mobile number. After the SMS code, you&apos;ll add your name and accept the terms.
            </p>
            <PhoneAuthForm next={next} />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";

import { OrDivider } from "./auth-shell";
import { GoogleButton } from "./google-button";
import { LoginForm } from "./login-form";
import { MethodTabs, type AuthMethod } from "./method-tabs";
import { PhoneAuthForm } from "./phone-auth-form";

export function LoginPanel({ next, notice }: { next: string | null; notice: string | null }) {
  const [method, setMethod] = useState<AuthMethod>("email");
  const [remember, setRemember] = useState(false);

  return (
    <div className="space-y-6">
      {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}
      <GoogleButton label="Log in with Google" next={next} remember={remember} />
      <OrDivider />
      <MethodTabs value={method} onChange={setMethod} />
      <div role="tabpanel" id={`panel-${method}`} aria-labelledby={`method-${method}`}>
        {method === "email" ? (
          <LoginForm next={next} remember={remember} />
        ) : (
          <PhoneAuthForm next={next} remember={remember} />
        )}
      </div>
      <Field orientation="horizontal">
        <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setRemember(c === true)} />
        <FieldLabel htmlFor="remember" className="font-normal">
          Keep me signed in for 14 days
        </FieldLabel>
      </Field>
    </div>
  );
}

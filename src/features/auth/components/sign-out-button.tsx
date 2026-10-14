"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { navigateAfterAuthChange, signOutEverywhere } from "../client/session";
import { authRoutes } from "../redirects";

export function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await signOutEverywhere();
      navigateAfterAuthChange(authRoutes.login, { replace: true });
    });
  return { signOut, pending };
}

export function SignOutButton(props: React.ComponentProps<typeof Button>) {
  const { signOut, pending } = useSignOut();
  return (
    <Button variant="outline" onClick={signOut} disabled={pending} {...props}>
      {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <LogOut data-icon="inline-start" aria-hidden="true" />}
      Log out
    </Button>
  );
}

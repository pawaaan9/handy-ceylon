import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthActionHandler } from "@/features/auth/components/auth-action-handler";
import { AuthShell, AuthShellSkeleton } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = { title: "Account action", robots: { index: false } };

const titles: Record<string, string> = {
  resetPassword: "Choose a new password",
  verifyEmail: "Verify your email",
  recoverEmail: "Restore your email address",
};

export default function AuthActionPage(props: PageProps<"/auth/action">) {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <AuthActionContent {...props} />
    </Suspense>
  );
}

async function AuthActionContent({ searchParams }: PageProps<"/auth/action">) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);
  const mode = pick("mode");
  return (
    <AuthShell art="secure" title={(mode && titles[mode]) || "Account action"}>
      <AuthActionHandler mode={mode} oobCode={pick("oobCode")} continueUrl={pick("continueUrl")} />
    </AuthShell>
  );
}

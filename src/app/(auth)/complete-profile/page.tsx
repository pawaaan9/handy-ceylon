import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, AuthShellSkeleton } from "@/features/auth/components/auth-shell";
import { CompleteProfileForm } from "@/features/auth/components/complete-profile-form";
import { homePathForUser, requireUser } from "@/features/auth/server/dal";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Finish setting up" };

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <CompleteProfileContent />
    </Suspense>
  );
}

async function CompleteProfileContent() {
  const user = await requireUser({ from: "/complete-profile", allowIncomplete: true });
  if (user.role) redirect(await homePathForUser(user));
  const signedInAs = user.email ?? formatLocalMobile(user.phoneNumber);

  return (
    <AuthShell
      art="join"
      title="Almost there"
      description={`You're signed in as ${signedInAs}. Add a few details to start using Handy Ceylon.`}
    >
      <CompleteProfileForm
        defaultName={user.displayName}
        verifiedPhone={user.phoneNumber ? formatLocalMobile(user.phoneNumber) : null}
      />
    </AuthShell>
  );
}

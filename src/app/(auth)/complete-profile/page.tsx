import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/features/auth/components/auth-card";
import { CompleteProfileForm } from "@/features/auth/components/complete-profile-form";
import { homePathForUser, requireUser } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Finish setting up" };

export default async function CompleteProfilePage() {
  const user = await requireUser({ from: "/complete-profile", allowIncomplete: true });
  if (user.role) redirect(await homePathForUser(user));

  return (
    <div className="flex justify-center py-4 sm:py-10">
      <AuthCard
        title="Finish setting up your account"
        description={`You're signed in as ${user.email}. Add a few details to start using Handy Ceylon.`}
      >
        <CompleteProfileForm defaultName={user.displayName} />
      </AuthCard>
    </div>
  );
}

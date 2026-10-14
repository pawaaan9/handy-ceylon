import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";
import { canAccessPath, safeNextPath } from "@/features/auth/redirects";
import { homePathForUser, isEmailVerified, requireUser } from "@/features/auth/server/dal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const user = await requireUser({ from: "/verify-email", allowIncomplete: true });
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  // Authoritative state from Firebase Auth, not the browser.
  const verified = await isEmailVerified(user.uid);
  const continueTo =
    next && canAccessPath(user.role, next) ? next : await homePathForUser(user);

  return (
    <div className="flex justify-center py-4 sm:py-10">
      {verified ? (
        <AuthCard title="Your email is verified">
          <div className="space-y-5">
            <p className="flex items-start gap-3 text-sm text-muted-foreground">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <span>
                <strong className="text-foreground">{user.email}</strong> is confirmed. You have full access to your
                account.
              </span>
            </p>
            <Button asChild size="xl" className="w-full">
              <Link href={continueTo}>Continue</Link>
            </Button>
          </div>
        </AuthCard>
      ) : (
        <AuthCard
          title="Verify your email"
          description="Confirming your email keeps your account secure and lets us send booking updates."
        >
          <VerifyEmailPanel email={user.email} next={next} />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href={continueTo} className="font-medium text-primary hover:underline">
              Skip for now
            </Link>
          </p>
        </AuthCard>
      )}
    </div>
  );
}

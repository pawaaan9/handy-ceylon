import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { AuthShell, AuthShellSkeleton } from "@/features/auth/components/auth-shell";
import { FirebaseAuthProvider } from "@/features/auth/components/firebase-auth-provider";
import { LinkEmailForm } from "@/features/auth/components/link-email-form";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";
import { canAccessPath, safeNextPath } from "@/features/auth/redirects";
import { homePathForUser, isEmailVerified, requireUser } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage(props: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <VerifyEmailContent {...props} />
    </Suspense>
  );
}

async function VerifyEmailContent({ searchParams }: PageProps<"/verify-email">) {
  const user = await requireUser({ from: "/verify-email", allowIncomplete: true });
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  // Authoritative state from Firebase Auth, not the browser.
  const verified = await isEmailVerified(user.uid);
  const continueTo = next && canAccessPath(user.role, next) ? next : await homePathForUser(user);

  if (!user.email) {
    return (
      <AuthShell
        art="secure"
        title="Add an email address"
        description="You signed up with your mobile number. Add an email to receive booking receipts and to apply as a technician."
        footer={
          <Link href={continueTo} className="font-semibold text-primary hover:underline">
            Skip for now
          </Link>
        }
      >
        <FirebaseAuthProvider uid={user.uid} role={user.role}>
          <LinkEmailForm returnTo={next ?? undefined} />
        </FirebaseAuthProvider>
      </AuthShell>
    );
  }

  if (verified) {
    return (
      <AuthShell art="secure" title="Your email is verified">
        <div className="space-y-6">
          <p className="flex items-start gap-3 text-muted-foreground">
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
      </AuthShell>
    );
  }

  return (
    <AuthShell
      art="secure"
      title="Verify your email"
      description="Confirming your email keeps your account secure and lets us send booking updates."
      footer={
        <Link href={continueTo} className="font-semibold text-primary hover:underline">
          Skip for now
        </Link>
      }
    >
      <FirebaseAuthProvider uid={user.uid} role={user.role}>
        <VerifyEmailPanel email={user.email} next={next} />
      </FirebaseAuthProvider>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, AuthShellSkeleton } from "@/features/auth/components/auth-shell";
import { LoginPanel } from "@/features/auth/components/login-panel";
import { authRoutes, postLoginPath, safeNextPath } from "@/features/auth/redirects";
import { getApplicationStatus, getCurrentUser } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Log in" };

const notices: Record<string, string> = {
  "signed-out": "You have been logged out.",
  expired: "Your session has expired. Please log in again.",
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <LoginGate {...props} />
    </Suspense>
  );
}

async function LoginGate({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const user = await getCurrentUser();
  if (user) {
    const applicationStatus = user.role === "customer" ? await getApplicationStatus(user.uid) : null;
    redirect(user.role ? postLoginPath({ role: user.role, applicationStatus }, next) : authRoutes.completeProfile);
  }
  const notice = typeof params.reason === "string" ? (notices[params.reason] ?? null) : null;
  const signUpHref = next ? `${authRoutes.signUp}?next=${encodeURIComponent(next)}` : authRoutes.signUp;

  return (
    <AuthShell
      art="home"
      title="Welcome back"
      description="Log in to manage your bookings, addresses and quotations."
      footer={
        <>
          New to Handy Ceylon?{" "}
          <Link href={signUpHref} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginPanel next={next} notice={notice} />
    </AuthShell>
  );
}

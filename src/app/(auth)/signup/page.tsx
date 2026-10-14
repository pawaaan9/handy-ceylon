import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard, AuthCardSkeleton } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { authRoutes, safeNextPath, technicianRoutes } from "@/features/auth/redirects";
import { getCurrentUser, homePathForUser } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage(props: PageProps<"/signup">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignUpGate {...props} />
    </Suspense>
  );
}

async function SignUpGate({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const user = await getCurrentUser();
  if (user) redirect(await homePathForUser(user));

  const applying = next === technicianRoutes.register;
  const loginHref = next ? `${authRoutes.login}?next=${encodeURIComponent(next)}` : authRoutes.login;

  return (
    <AuthCard
      title={applying ? "Create your account to apply" : "Create your account"}
      description={
        applying
          ? "Technicians start with a standard account. After you verify your email, you can submit your technician application."
          : "Book trusted technicians across Sri Lanka and track every job in one place."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}

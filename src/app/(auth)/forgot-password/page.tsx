import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { authRoutes } from "@/features/auth/redirects";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      art="secure"
      title="Reset your password"
      description="Enter the email address you use for Handy Ceylon and we'll send you a reset link. Signed up with a mobile number? Log in with your number instead."
      footer={
        <>
          Remembered it?{" "}
          <Link href={authRoutes.login} className="font-semibold text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}

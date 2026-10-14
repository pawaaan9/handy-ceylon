import { LogIn } from "lucide-react";
import type { Metadata } from "next";

import { LaunchingSoon } from "@/features/landing/components/launching-soon";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <LaunchingSoon
      icon={LogIn}
      title="Accounts are coming soon"
      description="Customer and technician sign-in will open together with booking."
    />
  );
}

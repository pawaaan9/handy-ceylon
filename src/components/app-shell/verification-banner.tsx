import { MailWarning } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authRoutes } from "@/features/auth/redirects";

export function VerificationBanner({ email, next }: { email: string; next?: string }) {
  const href = next ? `${authRoutes.verifyEmail}?next=${encodeURIComponent(next)}` : authRoutes.verifyEmail;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-urgent/25 bg-urgent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden="true" />
        <p className="text-sm text-foreground">
          <span className="font-semibold">Verify your email.</span>{" "}
          <span className="text-muted-foreground">We sent a link to {email}.</span>
        </p>
      </div>
      <Button asChild variant="outline" size="lg" className="bg-background">
        <Link href={href}>Verify now</Link>
      </Button>
    </div>
  );
}

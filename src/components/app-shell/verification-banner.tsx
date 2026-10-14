import { MailPlus, MailWarning } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authRoutes } from "@/features/auth/redirects";

/** Prompt to verify (or, for mobile-only accounts, add) an email address. */
export function VerificationBanner({ email, next }: { email: string | null; next?: string }) {
  const href = next ? `${authRoutes.verifyEmail}?next=${encodeURIComponent(next)}` : authRoutes.verifyEmail;
  const Icon = email ? MailWarning : MailPlus;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-urgent/25 bg-urgent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-urgent text-urgent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-foreground">
          {email ? (
            <>
              <span className="font-semibold">Verify your email.</span>{" "}
              <span className="text-muted-foreground">We sent a link to {email}.</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Add an email address.</span>{" "}
              <span className="text-muted-foreground">Get receipts by email and unlock technician applications.</span>
            </>
          )}
        </p>
      </div>
      <Button asChild variant="outline" size="lg" className="bg-background">
        <Link href={href}>{email ? "Verify now" : "Add email"}</Link>
      </Button>
    </div>
  );
}

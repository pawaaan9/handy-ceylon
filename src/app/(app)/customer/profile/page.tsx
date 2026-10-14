import { BadgeCheck, MailWarning, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authRoutes } from "@/features/auth/redirects";
import { requireRole } from "@/features/auth/server/dal";
import { CustomerProfileForm } from "@/features/customers/components/customer-profile-form";
import type { CustomerProfileFormValues } from "@/features/customers/schemas";
import { AvatarUploader } from "@/features/users/components/avatar-uploader";
import { formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Your profile" };

export default async function CustomerProfilePage() {
  const user = await requireRole(["customer"], { from: "/customer/profile" });
  const defaultValues: CustomerProfileFormValues = {
    fullName: user.displayName,
    phoneNumber: formatLocalMobile(user.phoneNumber),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Your profile" description="Keep your details up to date for smoother bookings." />

      <Panel title="Account">
        <div className="space-y-6">
          <AvatarUploader uid={user.uid} name={user.displayName} photoURL={user.photoURL} />
          <div className="flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Email address</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            {user.emailVerified ? (
              <Badge variant="secondary" className="gap-1 text-success">
                <BadgeCheck aria-hidden="true" /> Verified
              </Badge>
            ) : (
              <Link
                href={authRoutes.verifyEmail}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-urgent hover:underline"
              >
                <MailWarning className="size-4" aria-hidden="true" /> Verify email
              </Link>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <CustomerProfileForm defaultValues={defaultValues} />
      </Panel>

      <Panel title="Service addresses" description="Add, edit or remove the places technicians visit.">
        <Button asChild variant="outline" size="lg">
          <Link href="/customer/addresses">
            <MapPin data-icon="inline-start" aria-hidden="true" />
            Manage saved addresses
          </Link>
        </Button>
      </Panel>
    </div>
  );
}

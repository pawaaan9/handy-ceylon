import { ArrowRight, CalendarClock, HardHat, MapPin, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { VerificationBanner } from "@/components/app-shell/verification-banner";
import { Button } from "@/components/ui/button";
import { technicianRoutes } from "@/features/auth/redirects";
import { getApplicationStatus, requireRole } from "@/features/auth/server/dal";
import { addressLines } from "@/features/addresses/format";
import { getDefaultAddress } from "@/features/addresses/server/repository";
import { applicationStatusLabels } from "@/features/technicians/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CustomerDashboardPage() {
  const user = await requireRole(["customer"], { from: "/customer/dashboard" });
  const [defaultAddress, applicationStatus] = await Promise.all([
    getDefaultAddress(user.uid),
    getApplicationStatus(user.uid),
  ]);
  const firstName = user.displayName.split(" ")[0] || "there";
  const missing = [
    !user.photoURL && "a profile photo",
    !defaultAddress && "a service address",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <PageHeader title={`Hello, ${firstName}`} description="Manage your account and get ready to book." />
      {!user.emailVerified ? <VerificationBanner email={user.email} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Your bookings">
          <div className="flex flex-col items-start gap-4">
            <div className="flex gap-3 text-sm text-muted-foreground">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                You don&apos;t have any bookings yet. Get Help Now and Get a Quote open soon — your requests
                and quotations will appear here.
              </p>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link href="/services">Browse services</Link>
            </Button>
          </div>
        </Panel>

        <Panel title="Profile and addresses">
          <div className="space-y-4 text-sm">
            <p className="flex gap-3 text-muted-foreground">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              {defaultAddress ? (
                <span>
                  <span className="font-medium text-foreground">{defaultAddress.label}:</span>{" "}
                  {addressLines(defaultAddress).slice(0, 2).join(", ")}
                </span>
              ) : (
                <span>No service address yet.</span>
              )}
            </p>
            {missing.length > 0 ? (
              <p className="flex gap-3 text-muted-foreground">
                <UserRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>Add {missing.join(" and ")} so technicians can serve you faster.</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="lg">
                <Link href="/customer/addresses">
                  Manage addresses
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/customer/profile">Edit profile</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <HardHat className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">Work as a technician</p>
              <p className="text-sm text-muted-foreground">
                {applicationStatus
                  ? `Application status: ${applicationStatusLabels[applicationStatus]}.`
                  : "Apply to receive job requests from customers in your area."}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="lg">
            <Link href={applicationStatus ? technicianRoutes.application : technicianRoutes.register}>
              {applicationStatus ? "View application" : "Apply now"}
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}

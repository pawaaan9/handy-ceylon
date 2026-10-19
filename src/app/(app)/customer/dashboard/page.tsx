import { ArrowRight, CalendarClock, FileText, HardHat, MapPin, UserRound, Wrench, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionTile, Meter, SectionTitle, WelcomeBanner } from "@/components/app-shell/dashboard-kit";
import { VerificationBanner } from "@/components/app-shell/verification-banner";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { addressLines } from "@/features/addresses/format";
import { getDefaultAddress } from "@/features/addresses/server/repository";
import { technicianRoutes } from "@/features/auth/redirects";
import { getApplicationStatus, requireRole } from "@/features/auth/server/dal";
import { BookingStatusBadge } from "@/features/bookings/components/booking-display";
import { RequestStatusBadge } from "@/features/requests/components/request-status-badge";
import { listCustomerRequests } from "@/features/requests/server/repository";
import { requestTypeLabel } from "@/features/requests/types";
import { applicationStatusLabels } from "@/features/technicians/types";
import { formatDate } from "@/lib/format";
import { PageSkeleton } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CustomerDashboardPageContent />
    </Suspense>
  );
}

async function CustomerDashboardPageContent() {
  const user = await requireRole(["customer"], { from: "/customer/dashboard" });
  const [defaultAddress, applicationStatus, recentRequests] = await Promise.all([
    getDefaultAddress(user.uid),
    getApplicationStatus(user.uid),
    listCustomerRequests(user.uid, 4).catch(() => []),
  ]);
  const firstName = user.displayName.split(" ")[0] || "there";
  const checklist = [Boolean(user.photoURL), Boolean(defaultAddress), Boolean(user.email && user.emailVerified)];
  const done = checklist.filter(Boolean).length;

  return (
    <div className="space-y-8">
      <WelcomeBanner
        photo="plumberUnderSink"
        eyebrow="Customer dashboard"
        title={`Hello, ${firstName}`}
        description="Book trusted technicians, keep your addresses ready and track every job here."
        actions={
          <>
            <Button asChild variant="urgent" size="xl">
              <Link href={routes.getHelpNow}>
                <Zap data-icon="inline-start" aria-hidden="true" />
                Get Help Now
              </Link>
            </Button>
            <Button asChild size="xl" className="bg-white text-primary hover:bg-white/90">
              <Link href={routes.getAQuote}>
                <FileText data-icon="inline-start" aria-hidden="true" />
                Get a Quote
              </Link>
            </Button>
          </>
        }
      />

      {!user.emailVerified ? <VerificationBanner email={user.email} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionTile
          href={routes.services}
          icon={Wrench}
          tone="primary"
          title="Browse services"
          description="Plumbing, electrical, AC, cleaning and more."
        />
        <ActionTile
          href="/customer/addresses"
          icon={MapPin}
          tone="urgent"
          title="Saved addresses"
          description={
            defaultAddress
              ? `${defaultAddress.label} · ${addressLines(defaultAddress)[1]}`
              : "Add where technicians should come."
          }
        />
        <ActionTile href="/customer/profile" icon={UserRound} tone="navy" title="Profile" description="Photo and contact details.">
          <div className="mt-4">
            <Meter value={done} max={checklist.length} label="Profile completeness" />
          </div>
        </ActionTile>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-6">
          <SectionTitle
            action={
              recentRequests.length > 0 ? (
                <Link
                  href={routes.customerRequests}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View all
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : undefined
            }
          >
            Your requests
          </SectionTitle>
          {recentRequests.length > 0 ? (
            <ul className="mt-4 divide-y">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${routes.customerRequests}/${r.id}`}
                    className="flex items-start justify-between gap-3 rounded-md py-3 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{r.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {requestTypeLabel(r.mode)} · {formatDate(r.createdAt)}
                      </span>
                    </span>
                    {r.bookingStatus ? <BookingStatusBadge status={r.bookingStatus} /> : <RequestStatusBadge status={r.status} />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed bg-sand/50 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background text-primary">
                <CalendarClock className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-3 font-semibold text-foreground">No requests yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Use Get Help Now or Get a Quote to describe a job. Your requests will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-navy p-6 text-navy-foreground">
          <HardHat className="size-8 text-urgent" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Work as a technician</h2>
          <p className="mt-1 text-sm text-white/70">
            {applicationStatus
              ? `Your application: ${applicationStatusLabels[applicationStatus]}.`
              : "Receive job requests from customers in the districts you choose."}
          </p>
          <Button asChild variant="outline" size="lg" className="mt-5 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
            <Link href={applicationStatus ? technicianRoutes.application : technicianRoutes.register}>
              {applicationStatus ? "View application" : "Apply now"}
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

import { ArrowRight, BriefcaseBusiness, MapPin, Star, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionTitle, StatTile, WelcomeBanner } from "@/components/app-shell/dashboard-kit";
import { VerificationBanner } from "@/components/app-shell/verification-banner";
import { requireRole } from "@/features/auth/server/dal";
import { BookingStatusBadge } from "@/features/bookings/components/booking-display";
import { AvailabilityToggle } from "@/features/bookings/components/technician-request-actions";
import { listAvailableRequests, listTechnicianBookings } from "@/features/bookings/server/repository";
import { finishedBookingStatuses } from "@/features/bookings/types";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import { getTechnicianProfile } from "@/features/technicians/server/profile";
import { PageSkeleton } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Technician dashboard" };

export default function TechnicianDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianDashboardPageContent />
    </Suspense>
  );
}

async function TechnicianDashboardPageContent() {
  const user = await requireRole(["technician"], { from: "/technician/dashboard" });
  const [profile, categoryName, available, jobs] = await Promise.all([
    getTechnicianProfile(user.uid),
    getCategoryNamer(),
    listAvailableRequests(user.uid).catch(() => null),
    listTechnicianBookings(user.uid, 20).catch(() => []),
  ]);
  const activeJobs = jobs.filter((j) => !finishedBookingStatuses.includes(j.status));

  return (
    <div className="space-y-8">
      <WelcomeBanner
        tone="navy"
        photo="technicianToolBelt"
        eyebrow="Technician dashboard"
        title={`Welcome, ${user.displayName.split(" ")[0]}`}
        description="Your technician account is verified and active."
      />
      {!user.emailVerified ? <VerificationBanner email={user.email} /> : null}

      {profile ? (
        <section className="rounded-2xl border bg-card p-5">
          <AvailabilityToggle availability={profile.availability} />
          <p className="mt-2 text-sm text-muted-foreground">
            Customers only see technicians who are online. Go offline when you can&apos;t take urgent jobs.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Urgent requests for you" value={available ? available.requests.length : "—"} tone="urgent" />
        <StatTile label="Completed jobs" value={profile?.completedJobs ?? 0} tone="primary" />
        <StatTile
          label="Rating"
          value={profile && profile.ratingCount > 0 ? profile.ratingAverage.toFixed(1) : "New"}
          tone="sand"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border bg-card p-6">
          <SectionTitle
            action={
              <Link
                href="/technician/requests"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Urgent requests
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            Active jobs
          </SectionTitle>
          {activeJobs.length > 0 ? (
            <ul className="mt-4 divide-y">
              {activeJobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/technician/jobs/${j.id}`}
                    className="flex items-start justify-between gap-3 rounded-md py-3 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{j.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {j.city}, {j.district}
                      </span>
                    </span>
                    <BookingStatusBadge status={j.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed bg-sand/50 px-6 py-10 text-center">
              <BriefcaseBusiness className="size-8 text-primary" aria-hidden="true" />
              <p className="mt-3 font-semibold text-foreground">No active jobs</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Go online and accept an urgent request from customers in your districts.
              </p>
            </div>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <SectionTitle>Your services</SectionTitle>
          {profile ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex gap-3">
                <Wrench className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex flex-wrap gap-1.5">
                  {profile.categoryIds.map((id) => (
                    <span key={id} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary">
                      {categoryName(id)}
                    </span>
                  ))}
                </div>
              </div>
              <p className="flex gap-3 text-muted-foreground">
                <MapPin className="mt-0.5 size-5 shrink-0 text-urgent" aria-hidden="true" />
                {profile.serviceDistricts.join(", ")}
              </p>
              <p className="flex gap-3 text-muted-foreground">
                <Star className="mt-0.5 size-5 shrink-0 text-clay" aria-hidden="true" />
                Ratings appear after your first completed jobs.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Your technician profile is being prepared.</p>
          )}
        </section>
      </div>
    </div>
  );
}

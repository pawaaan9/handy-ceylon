import { Briefcase, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/server/dal";
import { BookingStatusBadge } from "@/features/bookings/components/booking-display";
import { listTechnicianBookings } from "@/features/bookings/server/repository";
import { finishedBookingStatuses } from "@/features/bookings/types";
import type { BookingSummaryView } from "@/features/bookings/views";
import { formatDate, formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "My jobs" };

export default function TechnicianJobsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianJobsContent />
    </Suspense>
  );
}

async function TechnicianJobsContent() {
  const user = await requireRole(["technician"], { from: "/technician/jobs" });
  let jobs: BookingSummaryView[] | null;
  try {
    jobs = await listTechnicianBookings(user.uid);
  } catch (error) {
    console.error("[technician] failed to list jobs", error);
    jobs = null;
  }
  const active = jobs?.filter((j) => !finishedBookingStatuses.includes(j.status)) ?? [];
  const past = jobs?.filter((j) => finishedBookingStatuses.includes(j.status)) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="My jobs" description="Jobs you've accepted, most recently updated first." />
      {jobs === null ? (
        <FormAlert tone="error">We couldn&apos;t load your jobs. Refresh the page to try again.</FormAlert>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
            <Briefcase className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">No jobs yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Accept an urgent request to start your first job.</p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/technician/requests">See urgent requests</Link>
          </Button>
        </div>
      ) : (
        <>
          <JobList title="Active" jobs={active} empty="No active jobs." />
          <JobList title="Completed and cancelled" jobs={past} empty="Nothing here yet." />
        </>
      )}
    </div>
  );
}

function JobList({ title, jobs, empty }: { title: string; jobs: BookingSummaryView[]; empty: string }) {
  return (
    <section aria-labelledby={`jobs-${title}`} className="space-y-3">
      <h2 id={`jobs-${title}`} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/technician/jobs/${j.id}`}
                className="block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{j.serviceName}</p>
                    <h3 className="font-semibold text-foreground">{j.title}</h3>
                  </div>
                  <BookingStatusBadge status={j.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden="true" />
                    {j.city}, {j.district}
                  </span>
                  {j.agreedTotalLkr !== null ? <span>Agreed {formatLkr(j.agreedTotalLkr)}</span> : null}
                  <span>Updated {formatDate(j.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

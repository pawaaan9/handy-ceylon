import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { AdminTable, FilterTabs, Stack } from "@/features/admin/components/admin-ui";
import { listJobs } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";
import { BookingStatusBadge } from "@/features/bookings/components/booking-display";
import { bookingModeLabels, finishedBookingStatuses } from "@/features/bookings/types";
import { formatDateTime, formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "Jobs" };

export default function AdminJobsPage(props: PageProps<"/admin/jobs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

const filters = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

async function Content({ searchParams }: PageProps<"/admin/jobs">) {
  await requireRole(["admin"], { from: "/admin/jobs" });
  const { status } = await searchParams;
  const filter = filters.find((f) => f.value === status)?.value ?? "all";
  const jobs = await listJobs();
  const matches = (j: (typeof jobs)[number], f: (typeof filters)[number]["value"]) =>
    f === "all" || (f === "active" ? !finishedBookingStatuses.includes(j.status) : j.status === f);
  const rows = jobs.filter((j) => matches(j, filter));

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" description="Bookings between customers and technicians, most recently updated first." />
      <FilterTabs
        label="Filter jobs"
        basePath="/admin/jobs"
        current={filter}
        options={filters.map((f) => ({ ...f, count: jobs.filter((j) => matches(j, f.value)).length }))}
      />
      <AdminTable
        caption="Jobs"
        columns={[
          { label: "Job" },
          { label: "Type" },
          { label: "Customer" },
          { label: "Technician" },
          { label: "Price", className: "text-right" },
          { label: "Status" },
          { label: "Updated" },
        ]}
        rows={rows.map((j) => ({
          key: j.id,
          href: `/admin/jobs/${j.id}`,
          cells: [
            <Stack key="t" main={j.title} sub={`${j.serviceName} · ${j.city}, ${j.district}`} />,
            bookingModeLabels[j.mode],
            j.customerName,
            j.technicianName,
            <span key="p" className="tabular-nums">
              {j.agreedTotalLkr !== null ? formatLkr(j.agreedTotalLkr) : j.inspectionFeeLkr > 0 ? `Visit ${formatLkr(j.inspectionFeeLkr)}` : "—"}
            </span>,
            <BookingStatusBadge key="s" status={j.status} />,
            j.updatedAt ? formatDateTime(new Date(j.updatedAt)) : "—",
          ],
        }))}
        empty={{ title: "No jobs here", description: "Jobs appear when a technician accepts or a customer selects an offer or quotation." }}
      />
    </div>
  );
}

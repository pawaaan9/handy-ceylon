import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { AdminTable, FilterTabs, Pill, Stack } from "@/features/admin/components/admin-ui";
import { listRequests } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";
import { BookingStatusBadge } from "@/features/bookings/components/booking-display";
import { bookingModeLabels, serviceRequestStatuses } from "@/features/bookings/types";
import { requestStatusLabels, urgencyOptions } from "@/features/requests/types";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Service requests" };

export default function AdminRequestsPage(props: PageProps<"/admin/requests">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

const filters = ["all", ...serviceRequestStatuses] as const;
const tones = { open: "orange", assigned: "blue", cancelled: "grey", expired: "grey" } as const;

async function Content({ searchParams }: PageProps<"/admin/requests">) {
  await requireRole(["admin"], { from: "/admin/requests" });
  const { status } = await searchParams;
  const filter = filters.find((f) => f === status) ?? "all";
  const requests = await listRequests();
  const rows = requests.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service requests"
        description="Every request customers have submitted, newest first. Requests with a technician link to their job."
      />
      <FilterTabs
        label="Filter requests by status"
        basePath="/admin/requests"
        current={filter}
        options={filters.map((f) => ({
          value: f,
          label: f === "all" ? "All" : requestStatusLabels[f],
          count: f === "all" ? requests.length : requests.filter((r) => r.status === f).length,
        }))}
      />
      <AdminTable
        caption="Service requests"
        columns={[
          { label: "Request" },
          { label: "Type" },
          { label: "Customer" },
          { label: "Area" },
          { label: "Responses" },
          { label: "Status" },
          { label: "Submitted" },
        ]}
        rows={rows.map((r) => ({
          key: r.id,
          href: r.bookingId ? `/admin/jobs/${r.bookingId}` : undefined,
          cells: [
            <Stack key="t" main={r.title} sub={`${r.serviceName} · ${urgencyOptions[r.urgency].label}`} />,
            bookingModeLabels[r.mode],
            r.customerName,
            `${r.city}, ${r.district}`,
            <span key="o" className="tabular-nums">
              {r.mode === "quote_online" ? `${r.quotationCount} quotes` : `${r.offerCount} offers`}
            </span>,
            r.bookingStatus ? (
              <BookingStatusBadge key="s" status={r.bookingStatus} />
            ) : (
              <Pill key="s" tone={tones[r.status]}>{requestStatusLabels[r.status]}</Pill>
            ),
            r.createdAt ? formatDateTime(new Date(r.createdAt)) : "—",
          ],
        }))}
        empty={{ title: "No requests here", description: "Customer requests appear as soon as they're submitted." }}
      />
    </div>
  );
}

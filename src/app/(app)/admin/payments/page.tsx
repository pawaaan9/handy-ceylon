import type { Metadata } from "next";
import { Suspense } from "react";

import { StatTile } from "@/components/app-shell/dashboard-kit";
import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { AdminTable, FilterTabs, Pill, Stack } from "@/features/admin/components/admin-ui";
import { listPayments } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";
import { formatDateTime, formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

export default function AdminPaymentsPage(props: PageProps<"/admin/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

const filters = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "awaiting_completion", label: "Job in progress" },
  { value: "void", label: "Nothing owed" },
] as const;
const tones = { due: "orange", awaiting_completion: "blue", void: "grey" } as const;
const labels = { due: "Due", awaiting_completion: "Job in progress", void: "Nothing owed" } as const;

async function Content({ searchParams }: PageProps<"/admin/payments">) {
  await requireRole(["admin"], { from: "/admin/payments" });
  const { status } = await searchParams;
  const filter = filters.find((f) => f.value === status)?.value ?? "all";
  const payments = await listPayments();
  const rows = payments.filter((p) => filter === "all" || p.status === filter);
  const sum = (s: keyof typeof labels) => payments.filter((p) => p.status === s).reduce((t, p) => t + p.totalDueLkr, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="What each job owes, kept in step with the booking. Payments are settled directly between customer and technician until online payments arrive."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Due now" value={formatLkr(sum("due"))} tone="urgent" />
        <StatTile label="Expected from jobs in progress" value={formatLkr(sum("awaiting_completion"))} tone="primary" />
      </div>
      <FilterTabs
        label="Filter payments"
        basePath="/admin/payments"
        current={filter}
        options={filters.map((f) => ({
          ...f,
          count: f.value === "all" ? payments.length : payments.filter((p) => p.status === f.value).length,
        }))}
      />
      <AdminTable
        caption="Payment records"
        columns={[
          { label: "Job" },
          { label: "Customer" },
          { label: "Technician" },
          { label: "Visit fee", className: "text-right" },
          { label: "Repairs", className: "text-right" },
          { label: "Total", className: "text-right" },
          { label: "Status" },
          { label: "Updated" },
        ]}
        rows={rows.map((p) => ({
          key: p.bookingId,
          href: `/admin/jobs/${p.bookingId}`,
          cells: [
            <Stack key="j" main="View job" sub={p.bookingId} />,
            p.customerName,
            p.technicianName,
            <span key="v" className="tabular-nums">{formatLkr(p.visitFeeLkr)}</span>,
            <span key="r" className="tabular-nums">{formatLkr(p.repairChargesLkr)}</span>,
            <span key="t" className="font-semibold tabular-nums">{formatLkr(p.totalDueLkr)}</span>,
            <Pill key="s" tone={tones[p.status]}>{labels[p.status]}</Pill>,
            p.updatedAt ? formatDateTime(new Date(p.updatedAt)) : "—",
          ],
        }))}
        empty={{ title: "No payment records here", description: "A record is created with every job." }}
      />
    </div>
  );
}

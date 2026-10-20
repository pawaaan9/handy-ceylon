import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { AdminTable, FilterTabs, Pill, Stack } from "@/features/admin/components/admin-ui";
import { listTechnicians } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import { formatDate, formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Technicians" };

export default function AdminTechniciansPage(props: PageProps<"/admin/technicians">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

const filters = ["all", "online", "offline", "suspended"] as const;

async function Content({ searchParams }: PageProps<"/admin/technicians">) {
  await requireRole(["admin"], { from: "/admin/technicians" });
  const { status } = await searchParams;
  const filter = filters.find((f) => f === status) ?? "all";
  const [technicians, categoryName] = await Promise.all([listTechnicians(), getCategoryNamer()]);
  const matches = (t: (typeof technicians)[number], f: (typeof filters)[number]) =>
    f === "all" ||
    (f === "suspended" ? t.verificationStatus !== "approved" || t.accountStatus !== "active" : t.availability === f);
  const rows = technicians.filter((t) => matches(t, filter));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technicians"
        description="Approved technician accounts, their coverage and live availability. New technicians come from approved applications."
      />
      <FilterTabs
        label="Filter technicians"
        basePath="/admin/technicians"
        current={filter}
        options={filters.map((f) => ({
          value: f,
          label: f === "all" ? "All" : f[0].toUpperCase() + f.slice(1),
          count: technicians.filter((t) => matches(t, f)).length,
        }))}
      />
      <AdminTable
        caption="Technicians"
        columns={[
          { label: "Technician" },
          { label: "Phone" },
          { label: "Services" },
          { label: "Districts" },
          { label: "Availability" },
          { label: "Account" },
          { label: "Jobs · rating" },
          { label: "Approved" },
        ]}
        rows={rows.map((t) => ({
          key: t.uid,
          // The approved application holds their documents and history.
          href: `/admin/technician-applications/${t.uid}`,
          cells: [
            <Stack key="n" main={t.displayName} sub={t.email ?? "No email"} />,
            t.phoneNumber ? formatLocalMobile(t.phoneNumber) : "—",
            <span key="c" className="text-muted-foreground">{t.categoryIds.map(categoryName).join(", ") || "—"}</span>,
            <Stack key="d" main={`${t.city}, ${t.district}`} sub={`Covers ${t.serviceDistricts.length} district${t.serviceDistricts.length === 1 ? "" : "s"}`} />,
            <Pill key="a" tone={t.availability === "online" ? "green" : "grey"}>{t.availability === "online" ? "Online" : "Offline"}</Pill>,
            <Pill key="s" tone={t.verificationStatus === "approved" && t.accountStatus === "active" ? "blue" : "red"}>
              {t.verificationStatus === "approved" && t.accountStatus === "active" ? "Active" : "Suspended"}
            </Pill>,
            <span key="j" className="tabular-nums">
              {t.completedJobs} · {t.ratingCount > 0 ? `${t.ratingAverage.toFixed(1)} (${t.ratingCount})` : "no reviews"}
            </span>,
            t.approvedAt ? formatDate(t.approvedAt) : "—",
          ],
        }))}
        empty={{
          title: filter === "all" ? "No technicians yet" : `No ${filter} technicians`,
          description: "Technicians appear here once you approve their application.",
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { AdminTable, FilterTabs, Pill, Stack } from "@/features/admin/components/admin-ui";
import { listCustomers } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";
import { formatDate, formatLocalMobile } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default function AdminCustomersPage(props: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

const filters = ["all", "active", "inactive"] as const;

async function Content({ searchParams }: PageProps<"/admin/customers">) {
  await requireRole(["admin"], { from: "/admin/customers" });
  const { status } = await searchParams;
  const filter = filters.find((f) => f === status) ?? "all";
  const customers = await listCustomers();
  const matches = (c: (typeof customers)[number], f: (typeof filters)[number]) =>
    f === "all" || (f === "active" ? c.accountStatus === "active" : c.accountStatus !== "active");
  const rows = customers.filter((c) => matches(c, filter));

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Everyone who has signed up, newest first." />
      <FilterTabs
        label="Filter customers"
        basePath="/admin/customers"
        current={filter}
        options={filters.map((f) => ({
          value: f,
          label: f === "all" ? "All" : f[0].toUpperCase() + f.slice(1),
          count: customers.filter((c) => matches(c, f)).length,
        }))}
      />
      <AdminTable
        caption="Customers"
        columns={[{ label: "Customer" }, { label: "Phone" }, { label: "Address saved" }, { label: "Account" }, { label: "Joined" }]}
        rows={rows.map((c) => ({
          key: c.uid,
          cells: [
            <Stack key="n" main={c.displayName} sub={c.email ?? "Mobile sign-in"} />,
            c.phoneNumber ? formatLocalMobile(c.phoneNumber) : "—",
            c.hasDefaultAddress ? "Yes" : <span key="a" className="text-muted-foreground">Not yet</span>,
            <Pill key="s" tone={c.accountStatus === "active" ? "green" : "red"}>{c.accountStatus}</Pill>,
            c.createdAt ? formatDate(c.createdAt) : "—",
          ],
        }))}
        empty={{ title: "No customers found", description: "New sign-ups appear here." }}
      />
    </div>
  );
}

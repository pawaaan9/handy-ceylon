import { ArrowRight, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, Panel } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { RefreshCatalogueButton } from "@/features/admin/components/refresh-catalogue-button";
import { requireRole } from "@/features/auth/server/dal";
import { loadActiveCatalogue } from "@/features/catalogue/server/repository";
import { countApplicationsByStatus } from "@/features/technicians/server/applications";
import { applicationStatusLabels, technicianApplicationStatuses } from "@/features/technicians/types";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  await requireRole(["admin"], { from: "/admin/dashboard" });
  const [counts, catalogue] = await Promise.all([
    countApplicationsByStatus(),
    // Uncached on purpose: admins see what Firestore holds right now.
    loadActiveCatalogue().catch(() => null),
  ]);
  const waiting = counts.pending + counts.under_review;

  return (
    <div className="space-y-8">
      <PageHeader title="Administration" description="Review technician applications and manage the platform." />
      <Panel title="Technician applications">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {technicianApplicationStatuses.map((status) => (
            <div key={status} className="rounded-lg border bg-muted/40 p-4">
              <dt className="text-sm text-muted-foreground">{applicationStatusLabels[status]}</dt>
              <dd className="mt-1 text-2xl font-bold text-foreground tabular-nums">{counts[status]}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardList className="size-4 text-primary" aria-hidden="true" />
            {waiting === 0 ? "No applications are waiting for review." : `${waiting} waiting for a decision.`}
          </p>
          <Button asChild size="lg">
            <Link href="/admin/technician-applications">
              Review applications
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Panel>

      <Panel
        title="Service catalogue"
        description="Categories and services live in Firestore. Public pages refresh every 15 minutes."
      >
        {catalogue ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{catalogue.categories.length}</span> active
            categories ·{" "}
            <span className="font-semibold text-foreground tabular-nums">{catalogue.services.length}</span> active services
          </p>
        ) : (
          <p className="text-sm text-destructive">The catalogue couldn&apos;t be read from Firestore.</p>
        )}
        {catalogue && catalogue.categories.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Seed it with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed:catalogue</code>.
          </p>
        ) : null}
        <div className="mt-4">
          <RefreshCatalogueButton />
        </div>
      </Panel>
    </div>
  );
}

import { ArrowRight, ClipboardList, Layers, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionTitle, StatTile, WelcomeBanner } from "@/components/app-shell/dashboard-kit";
import { Button } from "@/components/ui/button";
import { RefreshCatalogueButton } from "@/features/admin/components/refresh-catalogue-button";
import { getAdminOverview } from "@/features/admin/server/queries";
import { formatLkr } from "@/lib/format";
import { requireRole } from "@/features/auth/server/dal";
import { loadActiveCatalogue } from "@/features/catalogue/server/repository";
import { countApplicationsByStatus } from "@/features/technicians/server/applications";
import { applicationStatusLabels } from "@/features/technicians/types";
import { PageSkeleton } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminDashboardPageContent />
    </Suspense>
  );
}

async function AdminDashboardPageContent() {
  await requireRole(["admin"], { from: "/admin/dashboard" });
  const [counts, overview, catalogue] = await Promise.all([
    countApplicationsByStatus(),
    getAdminOverview().catch((error) => {
      console.error("[admin] overview failed", error);
      return null;
    }),
    // Uncached on purpose: admins see what Firestore holds right now.
    loadActiveCatalogue().catch(() => null),
  ]);
  const waiting = counts.pending + counts.under_review;

  return (
    <div className="space-y-8">
      <WelcomeBanner
        tone="navy"
        photo="electricalPanel"
        eyebrow="Administration"
        title="Platform overview"
        description={
          waiting === 0 ? "No technician applications are waiting for review." : `${waiting} application${waiting === 1 ? "" : "s"} waiting for a decision.`
        }
        actions={
          <Button asChild variant="urgent" size="xl">
            <Link href="/admin/technician-applications">
              <ClipboardList data-icon="inline-start" aria-hidden="true" />
              Review applications
            </Link>
          </Button>
        }
      />

      {overview ? (
        <section className="space-y-4">
          <SectionTitle>Platform</SectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <LinkedStat href="/admin/requests?status=open" label="Open requests" value={overview.openRequests} tone="urgent" />
            <LinkedStat href="/admin/jobs?status=active" label="Active jobs" value={overview.activeJobs} tone="primary" />
            <LinkedStat href="/admin/jobs?status=completed" label="Completed jobs" value={overview.completedJobs} tone="leaf" />
            <LinkedStat
              href="/admin/payments?status=due"
              label={`Payments due (${overview.paymentsDue})`}
              value={formatLkr(overview.paymentsDueLkr)}
              tone="sand"
            />
            <LinkedStat href="/admin/customers" label="Customers" value={overview.customers} tone="primary" />
            <LinkedStat href="/admin/technicians" label="Technicians" value={overview.technicians} tone="navy" />
            <LinkedStat href="/admin/technicians?status=online" label="Technicians online now" value={overview.techniciansOnline} tone="leaf" />
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionTitle>Technician applications</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label={applicationStatusLabels.pending} value={counts.pending} tone="urgent" />
          <StatTile label={applicationStatusLabels.under_review} value={counts.under_review} tone="primary" />
          <StatTile label={applicationStatusLabels.approved} value={counts.approved} tone="leaf" />
          <StatTile label={applicationStatusLabels.rejected} value={counts.rejected} tone="sand" />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <SectionTitle
          action={
            <Link href="/admin/catalogue" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Manage catalogue <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        >
          Service catalogue
        </SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Categories and services live in Firestore. Public pages refresh every 15 minutes.
        </p>
        {catalogue ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-xl bg-brand-soft p-4">
              <Layers className="size-6 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                <span className="block font-heading text-2xl font-bold text-foreground tabular-nums">
                  {catalogue.categories.length}
                </span>
                active categories
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-urgent-soft p-4">
              <Wrench className="size-6 text-urgent" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                <span className="block font-heading text-2xl font-bold text-foreground tabular-nums">
                  {catalogue.services.length}
                </span>
                active services
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-destructive">The catalogue couldn&apos;t be read from Firestore.</p>
        )}
        {catalogue && catalogue.categories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Seed it with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed:catalogue</code>.
          </p>
        ) : null}
        <div className="mt-5">
          <RefreshCatalogueButton />
        </div>
      </section>
    </div>
  );
}

function LinkedStat({ href, ...tile }: { href: string } & React.ComponentProps<typeof StatTile>) {
  return (
    <Link href={href} className="rounded-2xl transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <StatTile {...tile} />
    </Link>
  );
}

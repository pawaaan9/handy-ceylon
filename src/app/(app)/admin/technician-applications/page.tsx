import { ChevronRight, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { requireRole } from "@/features/auth/server/dal";
import { ApplicationStatusBadge } from "@/features/technicians/components/application-status-card";
import { listApplications } from "@/features/technicians/server/applications";
import {
  applicationStatusLabels,
  technicianApplicationStatuses,
  type TechnicianApplicationStatus,
} from "@/features/technicians/types";
import { getCategoryNamer } from "@/features/catalogue/server/queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Technician applications" };

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/technician-applications">) {
  await requireRole(["admin"], { from: "/admin/technician-applications" });
  const { status: rawStatus } = await searchParams;
  const status: TechnicianApplicationStatus = technicianApplicationStatuses.includes(
    rawStatus as TechnicianApplicationStatus,
  )
    ? (rawStatus as TechnicianApplicationStatus)
    : "pending";
  const [applications, categoryName] = await Promise.all([listApplications(status), getCategoryNamer()]);

  return (
    <div className="space-y-6">
      <PageHeader title="Technician applications" />
      <nav aria-label="Filter by status" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {technicianApplicationStatuses.map((s) => (
          <Link
            key={s}
            href={`/admin/technician-applications?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              s === status
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {applicationStatusLabels[s]}
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border bg-card px-4 py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-medium text-foreground">No {applicationStatusLabels[status].toLowerCase()} applications</p>
          <p className="mt-1 text-sm text-muted-foreground">New submissions will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {applications.map((app) => (
            <li key={app.uid}>
              <Link
                href={`/admin/technician-applications/${app.uid}`}
                className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{app.displayName}</p>
                    <ApplicationStatusBadge status={app.applicationStatus} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {app.serviceCategoryIds
                      .map(categoryName)
                      .join(", ")}{" "}
                    · {app.city}, {app.district} · {app.yearsOfExperience} yrs
                  </p>
                </div>
                <p className="hidden text-sm text-muted-foreground sm:block">{formatDate(app.submittedAt)}</p>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { CalendarClock, ClipboardList, MapPin, Paperclip, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageSkeleton } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/server/dal";
import { RequestStatusBadge } from "@/features/requests/components/request-status-badge";
import { formatSchedule } from "@/features/requests/format";
import { listCustomerRequests } from "@/features/requests/server/repository";
import { requestTypeLabel } from "@/features/requests/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My requests" };

export default function RequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequestsPageContent />
    </Suspense>
  );
}

async function RequestsPageContent() {
  const user = await requireRole(["customer"], { from: "/customer/requests" });
  let requests;
  try {
    requests = await listCustomerRequests(user.uid);
  } catch (error) {
    console.error("[requests] failed to list", error);
    requests = null;
  }

  const newButton = (
    <Button asChild size="xl">
      <Link href="/customer/requests/new">
        <Plus data-icon="inline-start" aria-hidden="true" />
        New request
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="My requests"
        description="Every job you've asked for, newest first."
        actions={requests && requests.length > 0 ? newButton : undefined}
      />

      {requests === null ? (
        <FormAlert tone="error">We couldn&apos;t load your requests. Please refresh the page to try again.</FormAlert>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
            <ClipboardList className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">No requests yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Describe a job once and verified technicians near you can respond.
          </p>
          <div className="mt-6">{newButton}</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/customer/requests/${r.id}`}
                className="block rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                      {requestTypeLabel(r.mode)}
                    </p>
                    <h2 className="mt-1 font-semibold text-foreground">{r.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {r.categoryName} · {r.serviceName}
                    </p>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden="true" />
                    {r.city}, {r.district}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {formatSchedule(r.preferredSchedule)}
                  </span>
                  {r.attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Paperclip className="size-4" aria-hidden="true" />
                      {r.attachmentCount} {r.attachmentCount === 1 ? "file" : "files"}
                    </span>
                  ) : null}
                  <span>Requested {formatDate(r.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { Clock, Inbox, MapPin, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { requireRole } from "@/features/auth/server/dal";
import { AvailabilityToggle, RequestResponseForm } from "@/features/bookings/components/technician-request-actions";
import { listAvailableRequests } from "@/features/bookings/server/repository";
import { urgencyOptions } from "@/features/requests/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Urgent requests" };

export default function TechnicianRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianRequestsContent />
    </Suspense>
  );
}

async function TechnicianRequestsContent() {
  const user = await requireRole(["technician"], { from: "/technician/requests" });
  let result;
  try {
    result = await listAvailableRequests(user.uid);
  } catch (error) {
    console.error("[technician] failed to list requests", error);
    result = null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Urgent requests"
        description="Get Help Now requests in your service categories and districts. The first technician to accept gets the job."
      />

      {result === null ? (
        <FormAlert tone="error">We couldn&apos;t load requests. Refresh the page to try again.</FormAlert>
      ) : result.technician === null ? (
        <FormAlert tone="error">Your technician profile could not be found. Contact Handy Ceylon support.</FormAlert>
      ) : (
        <>
          <Panel>
            <AvailabilityToggle availability={result.technician.availability} />
            {result.technician.blockedReason ? (
              <p className="mt-2 text-sm text-muted-foreground">{result.technician.blockedReason}</p>
            ) : null}
          </Panel>

          {result.requests.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
                <Inbox className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">No urgent requests right now</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                New requests in your categories and districts appear here. Refresh to check again.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {result.requests.map((r) => (
                <li key={r.id}>
                  <article className="rounded-xl border bg-card p-5" aria-labelledby={`req-${r.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                          {r.categoryName} · {r.serviceName}
                        </p>
                        <h2 id={`req-${r.id}`} className="mt-0.5 font-semibold text-foreground">
                          {r.title}
                        </h2>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          r.urgency === "emergency" ? "bg-urgent text-urgent-foreground" : "bg-urgent-soft text-urgent",
                        )}
                      >
                        {urgencyOptions[r.urgency].label}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-4 text-sm break-words whitespace-pre-line text-foreground">
                      {r.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" aria-hidden="true" />
                        {r.city}, {r.district}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4" aria-hidden="true" />
                        Requested {formatDateTime(new Date(r.createdAt))}
                      </span>
                      {r.attachmentCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Paperclip className="size-4" aria-hidden="true" />
                          {r.attachmentCount} photo{r.attachmentCount === 1 ? "" : "s"}/video{r.attachmentCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      The exact address and contact details are shared once you accept.
                    </p>
                    <div className="mt-4">
                      <RequestResponseForm requestId={r.id} canAccept={result.technician!.canAccept} />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

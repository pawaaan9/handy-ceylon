import { ArrowRight, Clock, Inbox, MapPin, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader, PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/server/dal";
import { AvailabilityToggle, RequestResponseForm } from "@/features/bookings/components/technician-request-actions";
import { listAvailableRequests } from "@/features/bookings/server/repository";
import { bookingModeLabels, bookingModes, type BookingMode } from "@/features/bookings/types";
import type { AvailableRequestView } from "@/features/bookings/views";
import { formatSchedule } from "@/features/requests/format";
import { urgencyOptions } from "@/features/requests/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Job requests" };

export default function TechnicianRequestsPage(props: PageProps<"/technician/requests">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianRequestsContent {...props} />
    </Suspense>
  );
}

const filters: { value: BookingMode | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...bookingModes.map((m) => ({ value: m, label: bookingModeLabels[m] })),
];

async function TechnicianRequestsContent({ searchParams }: PageProps<"/technician/requests">) {
  const user = await requireRole(["technician"], { from: "/technician/requests" });
  const { type } = await searchParams;
  const filter = filters.find((f) => f.value === type)?.value ?? "all";
  let result;
  try {
    result = await listAvailableRequests(user.uid);
  } catch (error) {
    console.error("[technician] failed to list requests", error);
    result = null;
  }
  const requests = result?.requests.filter((r) => filter === "all" || r.mode === filter) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Job requests"
        description="Requests in your service categories and districts. Accept urgent jobs, offer visits, or quote online."
      />

      {result === null ? (
        <FormAlert tone="error">We couldn&apos;t load requests. Refresh the page to try again.</FormAlert>
      ) : result.technician === null ? (
        <FormAlert tone="error">Your technician profile could not be found. Contact Handy Ceylon support.</FormAlert>
      ) : (
        <>
          <Panel>
            <AvailabilityToggle availability={result.technician.availability} />
            <p className="mt-2 text-sm text-muted-foreground">
              {result.technician.blockedReason ?? "You can accept Get Help Now requests."} Online status only affects
              urgent jobs; you can send visit offers and quotations at any time.
            </p>
          </Panel>

          <nav aria-label="Filter by booking type" className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Link
                key={f.value}
                href={f.value === "all" ? "/technician/requests" : `/technician/requests?type=${f.value}`}
                aria-current={filter === f.value ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:border-primary/40",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
                <Inbox className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-foreground">No requests right now</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                New requests in your categories and districts appear here. Refresh to check again.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {requests.map((r) => (
                <li key={r.id}>
                  <RequestCard request={r} canAcceptUrgent={result.technician!.canAcceptUrgent} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const responseLabels = { offer_pending: "Offer sent", quote_submitted: "Quotation sent" } as const;

function RequestCard({ request: r, canAcceptUrgent }: { request: AvailableRequestView; canAcceptUrgent: boolean }) {
  return (
    <article className="rounded-xl border bg-card p-5" aria-labelledby={`req-${r.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-xs font-semibold tracking-wide uppercase", r.mode === "urgent" ? "text-urgent" : "text-primary")}>
            {r.mode === "urgent" ? "Get Help Now" : `Get a Quote › ${bookingModeLabels[r.mode]}`}
          </p>
          <h2 id={`req-${r.id}`} className="mt-0.5 font-semibold text-foreground">
            {r.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {r.categoryName} · {r.serviceName}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.myResponse ? (
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
              {responseLabels[r.myResponse]}
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              r.urgency === "emergency" ? "bg-urgent text-urgent-foreground" : "bg-urgent-soft text-urgent",
            )}
          >
            {urgencyOptions[r.urgency].label}
          </span>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm break-words whitespace-pre-line text-foreground">{r.description}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          {r.city}, {r.district}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden="true" />
          {r.mode === "urgent" ? `Requested ${formatDateTime(new Date(r.createdAt))}` : formatSchedule(r.preferredSchedule)}
        </span>
        {r.attachmentCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Paperclip className="size-4" aria-hidden="true" />
            {r.attachmentCount} file{r.attachmentCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {r.mode === "urgent" ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">The exact address and contact details are shared once you accept.</p>
          <div className="mt-4">
            <RequestResponseForm requestId={r.id} canAccept={canAcceptUrgent} />
          </div>
        </>
      ) : (
        <div className="mt-4 border-t pt-4">
          <Button asChild size="lg" variant={r.myResponse ? "outline" : "default"}>
            <Link href={`/technician/requests/${r.id}`}>
              {r.myResponse
                ? "View your response"
                : r.mode === "quote_visit"
                  ? "View and offer a visit"
                  : "View and send a quotation"}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}

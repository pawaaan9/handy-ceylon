import { ArrowLeft, Film, MapPin, Phone, Radio, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { addressLines, formatPhone } from "@/features/addresses/format";
import { requireRole } from "@/features/auth/server/dal";
import { BookingPanel } from "@/features/bookings/components/booking-panel";
import { RemoteQuotationsComparison, VisitOffersComparison } from "@/features/bookings/components/quote-comparison";
import { countAvailableTechnicians, getBookingView } from "@/features/bookings/server/repository";
import { listRemoteQuotations, listVisitOffers } from "@/features/bookings/server/quotes";
import { listMessages } from "@/features/messages/server/repository";
import { CancelRequestButton } from "@/features/requests/components/cancel-request-button";
import { RequestStatusBadge } from "@/features/requests/components/request-status-badge";
import { formatBytes, formatSchedule } from "@/features/requests/format";
import { requestIdSchema } from "@/features/requests/schemas";
import { getCustomerRequest } from "@/features/requests/server/repository";
import {
  cancellationReasonLabels,
  requestStatusLabels,
  requestTypeLabel,
  urgencyOptions,
} from "@/features/requests/types";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Request" };

const messages: Record<string, { title: string; body: string }> = {
  created: {
    title: "Request submitted",
    body: "Your request is open. Technician responses will appear on this page.",
  },
  cancelled: { title: "Request cancelled", body: "Technicians will no longer see this request." },
};

export default function RequestPage(props: PageProps<"/customer/requests/[requestId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequestPageContent {...props} />
    </Suspense>
  );
}

async function RequestPageContent({ params, searchParams }: PageProps<"/customer/requests/[requestId]">) {
  const { requestId } = await params;
  const user = await requireRole(["customer"], { from: `/customer/requests/${requestId}` });
  const id = requestIdSchema.safeParse(requestId);
  if (!id.success) notFound();
  // Another customer's request is indistinguishable from a missing one.
  const [request, { status }] = await Promise.all([getCustomerRequest(user.uid, id.data), searchParams]);
  if (!request) notFound();
  const message = typeof status === "string" ? messages[status] : undefined;
  const waiting = request.status === "open";
  const [booking, availableNow, offers, quotations] = await Promise.all([
    request.bookingId ? getBookingView({ uid: user.uid, role: "customer" }, request.bookingId) : null,
    waiting
      ? countAvailableTechnicians(request.categoryId, request.district, {
          requireOnline: request.mode === "urgent",
        }).catch((error) => {
          console.error("[requests] availability count failed", error);
          return null;
        })
      : null,
    waiting && request.mode === "quote_visit" ? listVisitOffers(user.uid, request.id) : null,
    waiting && request.mode === "quote_online" ? listRemoteQuotations(user.uid, request.id) : null,
  ]);
  // Threads with each responding technician, for the comparison screens.
  const conversationIds = [...(offers ?? []), ...(quotations ?? [])]
    .map((r) => r.conversationId)
    .filter((c): c is string => Boolean(c));
  const threads = Object.fromEntries(
    await Promise.all(conversationIds.map(async (c) => [c, await listMessages(user.uid, c)] as const)),
  );
  const tradeName = request.categoryName.toLowerCase();
  const coverage =
    availableNow === null
      ? "Verified technicians who cover your area can see your request."
      : request.mode === "urgent"
        ? availableNow === 0
          ? `No verified ${tradeName} technicians covering ${request.district} are online right now. Your request stays open, and technicians will see it when they come online.`
          : `${availableNow} verified ${tradeName} technician${availableNow === 1 ? " is" : "s are"} online in ${request.district} now and can see your request.`
        : availableNow === 0
          ? `No verified ${tradeName} technicians cover ${request.district} yet. Your request stays open in case one joins.`
          : `${availableNow} verified ${tradeName} technician${availableNow === 1 ? " covers" : "s cover"} ${request.district} and can respond.`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/customer/requests"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All requests
      </Link>

      {message ? <FormAlert tone="success" title={message.title}>{message.body}</FormAlert> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{requestTypeLabel(request.mode)}</p>
          <h1 className="mt-1 text-2xl font-bold break-words text-foreground sm:text-3xl">{request.title}</h1>
          <p className="mt-1.5 text-muted-foreground">
            {request.categoryName}
            {request.subcategoryName ? ` › ${request.subcategoryName}` : ""} · {request.serviceName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {booking ? null : <RequestStatusBadge status={request.status} className="px-3 py-1 text-sm" />}
          {request.canCancel ? <CancelRequestButton requestId={request.id} /> : null}
        </div>
      </div>

      {waiting ? (
        <Panel>
          <div className="flex gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-urgent-soft text-urgent">
              <Radio className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold text-foreground">
                {request.mode === "urgent"
                  ? "Waiting for a technician to accept"
                  : request.mode === "quote_visit"
                    ? "Collecting visit offers"
                    : "Collecting quotations"}
              </p>
              <p className="text-muted-foreground">{coverage}</p>
              <p className="text-muted-foreground">
                Open until {formatDateTime(new Date(request.expiresAt))}. This page updates when you refresh it.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {offers ? (
        <section aria-labelledby="offers-title" className="space-y-3">
          <h2 id="offers-title" className="text-lg font-semibold text-foreground">
            Visit offers ({offers.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare each technician&apos;s visit fee, available times and profile. After the visit they send an
            itemized repair quotation for you to approve.
          </p>
          <VisitOffersComparison requestId={request.id} offers={offers} messages={threads} canSelect={waiting} />
        </section>
      ) : null}

      {quotations ? (
        <section aria-labelledby="quotes-title" className="space-y-3">
          <h2 id="quotes-title" className="text-lg font-semibold text-foreground">
            Quotations ({quotations.filter((q) => q.status === "submitted").length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Each technician quoted privately from your description, photos and measurements. Selecting one confirms the
            job at that price for the stated scope.
          </p>
          <RemoteQuotationsComparison quotations={quotations} messages={threads} canSelect={waiting} />
        </section>
      ) : null}

      {booking ? <BookingPanel booking={booking} audience="customer" viewerUid={user.uid} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Panel title="The job">
            <p className="break-words whitespace-pre-line text-foreground">{request.description}</p>
            <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
              <Detail label="Urgency" value={urgencyOptions[request.urgency].label} />
              <Detail label="Preferred time" value={formatSchedule(request.preferredSchedule)} />
              <Detail label="Requested" value={formatDateTime(new Date(request.createdAt))} />
              {request.status === "open" ? (
                <Detail label="Open until" value={formatDateTime(new Date(request.expiresAt))} />
              ) : null}
              {request.measurements ? (
                <div className="sm:col-span-2">
                  <Detail label="Measurements" value={request.measurements} />
                </div>
              ) : null}
              {request.siteConditions ? (
                <div className="sm:col-span-2">
                  <Detail label="Site details" value={request.siteConditions} />
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Photos & videos">
            {request.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.attachments.map((a) => (
                  <li key={a.storagePath} className="overflow-hidden rounded-lg border bg-muted/40">
                    {a.url && a.kind === "image" ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square">
                        {/* Short-lived signed URL to a private object; not optimisable by next/image. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
                      </a>
                    ) : a.url && a.kind === "video" ? (
                      <video src={a.url} controls preload="metadata" className="aspect-square w-full bg-black object-contain">
                        <track kind="captions" />
                      </video>
                    ) : (
                      <span className="flex aspect-square items-center justify-center text-muted-foreground">
                        <Film className="size-6" aria-hidden="true" />
                      </span>
                    )}
                    <p className="truncate px-2.5 py-2 text-xs text-muted-foreground" title={a.name}>
                      {a.name} · {formatBytes(a.sizeBytes)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Address" description="Saved with this request. Later changes to your saved addresses don't affect it.">
            {request.address ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{request.address.label}</p>
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {addressLines(request.address).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </p>
                <p className="flex gap-2">
                  <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {request.address.recipientName}
                </p>
                <p className="flex gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {formatPhone(request.address.contactNumber)}
                </p>
                {request.address.directions ? (
                  <p className="border-l-2 pl-3 italic">{request.address.directions}</p>
                ) : null}
                {request.accessInstructions ? (
                  <div className="border-t pt-3">
                    <p className="font-medium text-foreground">Access instructions</p>
                    <p className="mt-1 break-words whitespace-pre-line">{request.accessInstructions}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {request.city}, {request.district}
              </p>
            )}
          </Panel>

          <Panel title="Activity">
            <ol className="space-y-4">
              {request.history.map((event, i) => (
                <li key={`${event.at}-${i}`} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">
                      {event.from === null ? "Request submitted" : `Status changed to ${requestStatusLabels[event.to].toLowerCase()}`}
                    </p>
                    <p className="text-muted-foreground">{formatDateTime(new Date(event.at))}</p>
                    {event.to === "cancelled" && request.cancellation ? (
                      <p className="mt-1 text-muted-foreground">
                        {cancellationReasonLabels[request.cancellation.reason]}
                        {request.cancellation.note ? ` — ${request.cancellation.note}` : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words whitespace-pre-line text-foreground">{value}</dd>
    </div>
  );
}

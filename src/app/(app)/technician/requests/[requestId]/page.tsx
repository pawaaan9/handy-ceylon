import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/server/dal";
import { QuotationCard, formatVisitSlot } from "@/features/bookings/components/booking-display";
import { RemoteQuotationForm } from "@/features/bookings/components/quotation-form";
import {
  DeclineRequestButton,
  VisitOfferForm,
  WithdrawResponseButton,
} from "@/features/bookings/components/technician-request-actions";
import { MAX_QUOTATION_VERSIONS } from "@/features/bookings/schemas";
import { getTechnicianRequestView } from "@/features/bookings/server/quotes";
import { bookingModeLabels } from "@/features/bookings/types";
import { Conversation } from "@/features/messages/components/conversation";
import { listMessages } from "@/features/messages/server/repository";
import { formatSchedule } from "@/features/requests/format";
import { requestIdSchema } from "@/features/requests/schemas";
import { urgencyOptions } from "@/features/requests/types";
import { formatDateTime, formatLkr } from "@/lib/format";

export const metadata: Metadata = { title: "Request" };

export default function TechnicianRequestPage(props: PageProps<"/technician/requests/[requestId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TechnicianRequestContent {...props} />
    </Suspense>
  );
}

async function TechnicianRequestContent({ params }: PageProps<"/technician/requests/[requestId]">) {
  const { requestId } = await params;
  const user = await requireRole(["technician"], { from: `/technician/requests/${requestId}` });
  const id = requestIdSchema.safeParse(requestId);
  if (!id.success) notFound();
  // Not eligible and never responded → indistinguishable from missing.
  const request = await getTechnicianRequestView(user.uid, id.data);
  if (!request) notFound();
  const messages = await listMessages(user.uid, request.conversationId);

  const canRespond = request.blockedReason === null;
  const pendingQuote = request.myQuotations.find((q) => q.status === "submitted");
  const canQuoteAgain = request.myQuotations.length < MAX_QUOTATION_VERSIONS;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/technician/requests"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All requests
      </Link>

      <div>
        <p className="text-sm font-semibold text-primary">Get a Quote › {bookingModeLabels[request.mode]}</p>
        <h1 className="mt-1 text-2xl font-bold break-words text-foreground sm:text-3xl">{request.title}</h1>
        <p className="mt-1.5 text-muted-foreground">
          {request.categoryName} · {request.serviceName}
        </p>
      </div>

      {request.bookingId ? (
        <FormAlert tone="success" title="The customer chose you">
          <Button asChild variant="link" className="h-auto p-0">
            <Link href={`/technician/jobs/${request.bookingId}`}>Open the job</Link>
          </Button>
        </FormAlert>
      ) : request.blockedReason ? (
        <FormAlert tone="info">{request.blockedReason}</FormAlert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Panel title="The job">
            <p className="text-sm break-words whitespace-pre-line text-foreground">{request.description}</p>
            <dl className="mt-5 grid gap-4 border-t pt-5 text-sm">
              <Detail label="Area" value={`${request.city}, ${request.district} (exact address shared if you're chosen)`} />
              <Detail label="Customer's timing" value={formatSchedule(request.preferredSchedule)} />
              <Detail label="Urgency" value={urgencyOptions[request.urgency].label} />
              {request.measurements ? <Detail label="Measurements" value={request.measurements} /> : null}
              {request.siteConditions ? <Detail label="Site details" value={request.siteConditions} /> : null}
              <Detail label="Open until" value={formatDateTime(new Date(request.expiresAt))} />
            </dl>
          </Panel>
          <Panel title="Photos & videos">
            {request.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.attachments.map((a, i) => (
                  <li key={i} className="overflow-hidden rounded-md border bg-muted/40">
                    {a.url && a.kind === "image" ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="block aspect-square">
                        {/* Short-lived signed URL to a private object; not optimisable by next/image. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} className="size-full object-cover" loading="lazy" />
                      </a>
                    ) : a.url ? (
                      <video src={a.url} controls preload="metadata" className="aspect-square w-full bg-black object-contain">
                        <track kind="captions" />
                      </video>
                    ) : (
                      <span className="block p-2 text-xs text-muted-foreground">{a.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          {request.mode === "quote_visit" ? (
            <Panel
              title={request.myOffer?.status === "pending" ? "Your offer" : "Offer a visit"}
              description="The customer compares visit fees, times and profiles, then chooses one technician."
            >
              {request.myOffer && request.myOffer.status !== "pending" ? (
                <p className="text-sm text-muted-foreground">
                  {request.myOffer.status === "selected"
                    ? `Selected for ${request.myOffer.chosenVisit ? formatVisitSlot(request.myOffer.chosenVisit) : "a visit"} at ${formatLkr(request.myOffer.inspectionFeeLkr)}.`
                    : request.myOffer.status === "not_selected"
                      ? "The customer chose another technician."
                      : "You withdrew this offer."}
                </p>
              ) : canRespond ? (
                <div className="space-y-4">
                  <VisitOfferForm
                    requestId={request.id}
                    existing={
                      request.myOffer
                        ? {
                            inspectionFeeLkr: request.myOffer.inspectionFeeLkr,
                            proposedVisits: request.myOffer.proposedVisits,
                            message: request.myOffer.message,
                          }
                        : null
                    }
                  />
                  {request.myOffer ? <WithdrawResponseButton requestId={request.id} /> : <DeclineRequestButton requestId={request.id} />}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">You can&apos;t send an offer for this request.</p>
              )}
            </Panel>
          ) : (
            <Panel
              title={pendingQuote ? "Your quotation" : "Send a quotation"}
              description="Quotations are private: the customer sees every technician's price, but technicians never see each other's."
            >
              <div className="space-y-5">
                {request.myQuotations.map((q) => (
                  <QuotationCard key={q.id} quotation={q} audience="technician" />
                ))}
                {pendingQuote ? <WithdrawResponseButton quotationId={pendingQuote.id} /> : null}
                {canRespond && canQuoteAgain ? (
                  <div className="space-y-3 border-t pt-5">
                    {pendingQuote ? (
                      <p className="text-sm text-muted-foreground">
                        Need to change it? A new version replaces your current quotation.
                      </p>
                    ) : null}
                    <RemoteQuotationForm requestId={request.id} isRevision={Boolean(pendingQuote)} />
                    {request.myQuotations.length === 0 ? <DeclineRequestButton requestId={request.id} /> : null}
                  </div>
                ) : null}
              </div>
            </Panel>
          )}

          <Panel title="Questions for the customer">
            {messages ? (
              <Conversation
                conversationId={request.conversationId}
                messages={messages}
                otherName="the customer"
                emptyHint="Ask about the scope before you price it."
              />
            ) : (
              <p className="flex gap-2 text-sm text-muted-foreground">
                <Briefcase className="size-4 shrink-0" aria-hidden="true" />
                Messaging opens once you send {request.mode === "quote_visit" ? "an offer" : "a quotation"}.
              </p>
            )}
          </Panel>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5" aria-hidden="true" />
        The customer&apos;s exact address, contact number and access instructions are shared only if you&apos;re chosen.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words whitespace-pre-line text-foreground">{value}</dd>
    </div>
  );
}

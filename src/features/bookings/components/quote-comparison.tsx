import { Clock, Inbox, MessageSquare } from "lucide-react";

import { Conversation } from "@/features/messages/components/conversation";
import type { MessageView } from "@/features/messages/schemas";
import { formatDate, formatLkr } from "@/lib/format";

import type { RemoteQuotationView, VisitOfferView } from "../views";
import { QuotationCard, TechnicianCard } from "./booking-display";
import { SelectOfferForm, SelectQuotationButton } from "./quote-selection";

type Messages = Record<string, MessageView[] | null>;

function EmptyResponses({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
        <Inbox className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Thread({ conversationId, messages, name }: { conversationId: string | null; messages: Messages; name: string }) {
  if (!conversationId) return null;
  const thread = messages[conversationId];
  return (
    <details className="group rounded-lg border bg-background">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
        <MessageSquare className="size-4 text-primary" aria-hidden="true" />
        Message {name}
        {thread && thread.length > 0 ? <span className="text-muted-foreground">({thread.length})</span> : null}
      </summary>
      <div className="border-t p-3">
        <Conversation
          conversationId={conversationId}
          messages={thread ?? []}
          otherName={name}
          emptyHint="Ask about the scope, materials or timing before you choose."
        />
      </div>
    </details>
  );
}

/** Technician Visit: compare visit offers (fee, times, profile) and choose one. */
export function VisitOffersComparison({
  requestId,
  offers,
  messages,
  canSelect,
}: {
  requestId: string;
  offers: VisitOfferView[];
  messages: Messages;
  canSelect: boolean;
}) {
  if (offers.length === 0) {
    return (
      <EmptyResponses
        title="No visit offers yet"
        description="Technicians who cover your area will offer a visit fee and times. Refresh this page to check for new offers."
      />
    );
  }
  return (
    <ul className="space-y-4" aria-label="Visit offers, lowest fee first">
      {offers.map((offer) => {
        const name = offer.technician?.displayName ?? "This technician";
        return (
          <li key={offer.technicianId} className="space-y-4 rounded-xl border bg-card p-5">
            {offer.technician ? <TechnicianCard technician={offer.technician} compact /> : null}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Visit fee <span className="text-xs">(visit and inspection only — repairs are quoted after)</span>
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {offer.inspectionFeeLkr > 0 ? formatLkr(offer.inspectionFeeLkr) : "Free"}
              </p>
            </div>
            {offer.message ? <p className="border-l-2 pl-3 text-sm text-muted-foreground italic">“{offer.message}”</p> : null}
            {canSelect && offer.status === "pending" && offer.technician?.verified ? (
              <SelectOfferForm
                requestId={requestId}
                technicianId={offer.technicianId}
                technicianName={name}
                proposedVisits={offer.proposedVisits}
                inspectionFeeLkr={offer.inspectionFeeLkr}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {offer.status === "selected" ? "You chose this offer." : "This offer can't be selected right now."}
              </p>
            )}
            <Thread conversationId={offer.conversationId} messages={messages} name={name} />
          </li>
        );
      })}
    </ul>
  );
}

/** Quote Online: compare sealed quotations (price, timeline, scope, profile) and select one. */
export function RemoteQuotationsComparison({
  quotations,
  messages,
  canSelect,
}: {
  quotations: RemoteQuotationView[];
  messages: Messages;
  canSelect: boolean;
}) {
  if (quotations.length === 0) {
    return (
      <EmptyResponses
        title="No quotations yet"
        description="Technicians who cover your area will quote from your description, photos and measurements. Refresh to check for new quotations."
      />
    );
  }
  return (
    <ul className="space-y-5" aria-label="Quotations, lowest price first">
      {quotations.map((q) => {
        const name = q.technician?.displayName ?? "This technician";
        const selectable = canSelect && q.status === "submitted" && Boolean(q.technician?.verified);
        return (
          <li key={q.id} className="space-y-4 rounded-xl border bg-card p-5">
            {q.technician ? <TechnicianCard technician={q.technician} compact /> : null}
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-sm">
              <p>
                <span className="text-muted-foreground">Total </span>
                <span className="text-xl font-bold text-foreground tabular-nums">{formatLkr(q.totalLkr)}</span>
              </p>
              {q.estimatedDurationHours ? (
                <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  About {q.estimatedDurationHours} hours of work
                </p>
              ) : null}
              <p className="text-muted-foreground">
                {q.status === "expired" ? "Expired" : `Valid until ${formatDate(q.validUntil)}`}
              </p>
            </div>
            <QuotationCard quotation={q} audience="customer" />
            {selectable ? (
              <SelectQuotationButton quotationId={q.id} technicianName={name} totalLkr={q.totalLkr} />
            ) : q.status === "expired" ? (
              <p className="text-sm text-muted-foreground">This quotation expired. Message {name} to ask for a new one.</p>
            ) : null}
            <Thread conversationId={q.conversationId} messages={messages} name={name} />
          </li>
        );
      })}
    </ul>
  );
}

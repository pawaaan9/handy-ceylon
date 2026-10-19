import { Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { Conversation } from "@/features/messages/components/conversation";
import { listMessages } from "@/features/messages/server/repository";
import { formatDateTime, formatLkr } from "@/lib/format";

import { bookingModeLabels, bookingStatusLabels } from "../types";
import type { BookingView } from "../views";
import { BookingActions } from "./booking-actions";
import {
  BookingProgress,
  BookingStatusBadge,
  formatVisitSlot,
  NextSteps,
  QuotationCard,
  TechnicianCard,
} from "./booking-display";

const roleNames = { customer: "the customer", technician: "the technician", admin: "Handy Ceylon", system: "Handy Ceylon" };

const paymentLabels = {
  awaiting_completion: "Payable when the job is complete",
  due: "Due now — pay your technician directly",
  void: "Nothing to pay",
} as const;

/** The job as one party sees it: status, next steps, people, quotations, payment, messages and history. */
export async function BookingPanel({
  booking,
  audience,
  viewerUid,
}: {
  booking: BookingView;
  audience: "customer" | "technician";
  viewerUid: string;
}) {
  const messages = booking.conversationId ? await listMessages(viewerUid, booking.conversationId) : null;
  const visitFeeLabel = booking.mode === "urgent" ? "Inspection fee" : "Visit fee";

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Job status <span className="font-normal text-muted-foreground">· {bookingModeLabels[booking.mode]}</span>
          </h2>
          <BookingStatusBadge status={booking.status} className="px-3 py-1 text-sm" />
        </div>
        <div className="mt-5 space-y-5">
          <BookingProgress mode={booking.mode} status={booking.status} cancelledFrom={booking.cancellation?.fromStatus} />
          <NextSteps status={booking.status} audience={audience} mode={booking.mode} />
          {booking.cancellation ? (
            <FormAlert tone="info" title={`Cancelled by ${roleNames[booking.cancellation.by]}`}>
              <p>{booking.cancellation.reason}</p>
              {booking.cancellation.inspectionFeeDue ? (
                <p className="mt-1">
                  The agreed {visitFeeLabel.toLowerCase()} of {formatLkr(booking.inspectionFeeLkr)} is due.
                </p>
              ) : null}
            </FormAlert>
          ) : null}
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            {booking.mode !== "quote_online" ? (
              <div>
                <dt className="text-muted-foreground">{visitFeeLabel}</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {booking.inspectionFeeLkr > 0 ? formatLkr(booking.inspectionFeeLkr) : "Free"}
                </dd>
              </div>
            ) : null}
            {booking.scheduledVisit ? (
              <div>
                <dt className="text-muted-foreground">Agreed visit</dt>
                <dd className="mt-0.5 font-medium text-foreground">{formatVisitSlot(booking.scheduledVisit)}</dd>
              </div>
            ) : null}
            {booking.etaMinutes && !booking.arrivedAt ? (
              <div>
                <dt className="text-muted-foreground">Arrival estimate</dt>
                <dd className="mt-0.5 font-medium text-foreground">About {booking.etaMinutes} minutes after confirming</dd>
              </div>
            ) : null}
            {booking.agreedTotalLkr !== null ? (
              <div>
                <dt className="text-muted-foreground">Agreed price</dt>
                <dd className="mt-0.5 font-medium text-foreground">{formatLkr(booking.agreedTotalLkr)}</dd>
              </div>
            ) : null}
          </dl>
          {booking.technicianMessage ? (
            <p className="border-l-2 pl-3 text-sm text-muted-foreground italic">“{booking.technicianMessage}”</p>
          ) : null}
          <BookingActions booking={booking} audience={audience} />
        </div>
      </Panel>

      {audience === "customer" && booking.technician ? (
        <Panel title="Your technician">
          <TechnicianCard technician={booking.technician} />
        </Panel>
      ) : null}

      {booking.payment ? (
        <Panel title="Payment" description="No online payment yet: the amount is settled directly with the technician.">
          <dl className="space-y-1.5 text-sm">
            {booking.mode !== "quote_online" ? (
              <div className="flex justify-between text-muted-foreground">
                <dt>{visitFeeLabel}</dt>
                <dd className="tabular-nums">{formatLkr(booking.payment.visitFeeLkr)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-muted-foreground">
              <dt>Repair charges</dt>
              <dd className="tabular-nums">{formatLkr(booking.payment.repairChargesLkr)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold text-foreground">
              <dt>{booking.payment.status === "awaiting_completion" ? "Expected total" : "Total"}</dt>
              <dd className="tabular-nums">{formatLkr(booking.payment.totalDueLkr)}</dd>
            </div>
            <p className="pt-1 text-muted-foreground">{paymentLabels[booking.payment.status]}</p>
          </dl>
        </Panel>
      ) : null}

      {booking.quotations.length > 0 ? (
        <Panel title="Quotations" description="Every version is kept, including any accepted earlier.">
          <div className="space-y-4">
            {booking.quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} audience={audience} />
            ))}
          </div>
        </Panel>
      ) : null}

      {booking.conversationId && messages ? (
        <Panel title="Messages">
          <Conversation
            conversationId={booking.conversationId}
            messages={messages}
            otherName={audience === "customer" ? (booking.technician?.displayName ?? "your technician") : "the customer"}
            emptyHint="Use messages to agree details about the job's scope and timing."
          />
        </Panel>
      ) : null}

      <Panel title="Job history">
        <ol className="space-y-3">
          {booking.history.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  {bookingStatusLabels[event.to]}{" "}
                  <span className="font-normal text-muted-foreground">by {roleNames[event.actorRole]}</span>
                </p>
                <p className="text-muted-foreground">{formatDateTime(new Date(event.at))}</p>
                {event.note ? <p className="mt-0.5 text-muted-foreground">{event.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

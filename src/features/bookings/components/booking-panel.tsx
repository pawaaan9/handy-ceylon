import { Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { formatDateTime, formatLkr } from "@/lib/format";

import { bookingStatusLabels } from "../types";
import type { BookingView } from "../views";
import { BookingActions } from "./booking-actions";
import { BookingProgress, BookingStatusBadge, NextSteps, QuotationCard, TechnicianCard } from "./booking-display";

const roleNames = { customer: "the customer", technician: "the technician", admin: "Handy Ceylon", system: "Handy Ceylon" };

/** The job as one party sees it: status, next steps, people, quotations, actions and history. */
export function BookingPanel({ booking, audience }: { booking: BookingView; audience: "customer" | "technician" }) {
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Job status</h2>
          <BookingStatusBadge status={booking.status} className="px-3 py-1 text-sm" />
        </div>
        <div className="mt-5 space-y-5">
          <BookingProgress status={booking.status} cancelledFrom={booking.cancellation?.fromStatus} />
          <NextSteps status={booking.status} audience={audience} />
          {booking.cancellation ? (
            <FormAlert tone="info" title={`Cancelled by ${roleNames[booking.cancellation.by]}`}>
              <p>{booking.cancellation.reason}</p>
              {booking.cancellation.inspectionFeeDue ? (
                <p className="mt-1">The agreed inspection fee of {formatLkr(booking.inspectionFeeLkr)} is due.</p>
              ) : null}
            </FormAlert>
          ) : null}
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Inspection fee</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {booking.inspectionFeeLkr > 0 ? formatLkr(booking.inspectionFeeLkr) : "Free"}
              </dd>
            </div>
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

      {booking.quotations.length > 0 ? (
        <Panel title="Quotations">
          <div className="space-y-4">
            {booking.quotations.map((q) => (
              <QuotationCard key={q.id} quotation={q} audience={audience} />
            ))}
          </div>
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

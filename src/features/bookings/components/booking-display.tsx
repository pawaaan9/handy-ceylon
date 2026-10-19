import { BadgeCheck, Briefcase, Check, MapPin, Phone, Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatLkr, formatLocalMobile, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  bookingStatusLabels,
  quotationLineKindLabels,
  quotationStatusLabels,
  type BookingMode,
  type BookingStatus,
} from "../types";
import type { QuotationView, TechnicianPublicView } from "../views";

export { formatVisitSlot } from "./visit-slot";

const statusTones: Partial<Record<BookingStatus, string>> = {
  awaiting_customer_approval: "bg-urgent-soft text-urgent",
  quote_rejected: "bg-sand text-clay",
  confirmed: "bg-success/10 text-success",
  work_in_progress: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        statusTones[status] ?? "bg-brand-soft text-primary",
        className,
      )}
    >
      {bookingStatusLabels[status]}
    </span>
  );
}

type Stage = { label: string; statuses: BookingStatus[] };
const stages: Record<BookingMode, Stage[]> = {
  urgent: [
    { label: "Technician assigned", statuses: ["technician_assigned"] },
    { label: "Visit confirmed", statuses: ["visit_scheduled"] },
    { label: "On the way", statuses: ["en_route"] },
    { label: "Inspection", statuses: ["inspecting"] },
    { label: "Quotation", statuses: ["awaiting_customer_approval", "quote_rejected"] },
    { label: "Job confirmed", statuses: ["confirmed"] },
    { label: "Work in progress", statuses: ["work_in_progress"] },
    { label: "Completed", statuses: ["completed"] },
  ],
  quote_visit: [
    { label: "Visit booked", statuses: ["visit_scheduled"] },
    { label: "On the way", statuses: ["en_route"] },
    { label: "Inspection", statuses: ["inspecting"] },
    { label: "Final quotation", statuses: ["awaiting_customer_approval", "quote_rejected"] },
    { label: "Job confirmed", statuses: ["confirmed"] },
    { label: "Work in progress", statuses: ["work_in_progress"] },
    { label: "Completed", statuses: ["completed"] },
  ],
  quote_online: [
    { label: "Quotation selected", statuses: ["confirmed"] },
    { label: "On the way", statuses: ["en_route"] },
    { label: "On site", statuses: ["inspecting", "awaiting_customer_approval", "quote_rejected"] },
    { label: "Work in progress", statuses: ["work_in_progress"] },
    { label: "Completed", statuses: ["completed"] },
  ],
};

/** Where the job is in its option's lifecycle. */
export function BookingProgress({
  mode,
  status,
  cancelledFrom,
}: {
  mode: BookingMode;
  status: BookingStatus;
  cancelledFrom?: BookingStatus;
}) {
  const list = stages[mode];
  const effective = status === "cancelled" ? cancelledFrom : status;
  const currentIndex = list.findIndex((p) => effective && p.statuses.includes(effective));
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-4", list.length > 6 ? "lg:grid-cols-8" : "lg:grid-cols-5")} aria-label="Job progress">
      {list.map((p, i) => {
        const done = status === "completed" || i < currentIndex;
        const current = i === currentIndex && status !== "completed";
        return (
          <li key={p.label} className="flex items-center gap-2 sm:flex-col sm:items-start" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "h-1.5 w-6 shrink-0 rounded-full sm:w-full",
                done ? "bg-primary" : current ? (status === "cancelled" ? "bg-destructive" : "bg-urgent") : "bg-muted",
              )}
              aria-hidden="true"
            />
            <span className={cn("flex items-center gap-1 text-xs", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {done ? <Check className="size-3 text-primary" aria-hidden="true" /> : null}
              {p.label}
              {done ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A verified technician's profile, as customers see it when comparing or booking. */
export function TechnicianCard({ technician, compact }: { technician: TechnicianPublicView; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar className={cn("border", compact ? "size-12" : "size-16")}>
        {technician.photoURL ? <AvatarImage src={technician.photoURL} alt="" className="object-cover" /> : null}
        <AvatarFallback className="bg-brand-soft text-lg font-semibold text-primary">
          {initials(technician.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-foreground">{technician.displayName}</p>
          {technician.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Verified by Handy Ceylon
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              Account not active
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-4 text-clay" aria-hidden="true" />
            {technician.ratingCount > 0
              ? `${technician.ratingAverage.toFixed(1)} (${technician.ratingCount} reviews)`
              : "No reviews yet"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="size-4" aria-hidden="true" />
            {technician.yearsOfExperience} years’ experience · {technician.completedJobs} jobs completed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {technician.city}, {technician.district}
          </span>
          {technician.phoneNumber ? (
            <a
              href={`tel:${technician.phoneNumber}`}
              className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <Phone className="size-4" aria-hidden="true" />
              {formatLocalMobile(technician.phoneNumber)}
            </a>
          ) : null}
        </div>
        {!compact && technician.skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
            {technician.skills.slice(0, 8).map((skill) => (
              <li key={skill} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary">
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
        {!compact && technician.approvedAt ? (
          <p className="text-xs text-muted-foreground">Verified since {formatDate(technician.approvedAt)}</p>
        ) : null}
      </div>
    </div>
  );
}

function quotationTitle(q: QuotationView): string {
  if (q.revisionOfQuotationId) return `Revised quotation (v${q.version})`;
  if (q.mode === "quote_online") return q.version > 1 ? `Online quotation (v${q.version})` : "Online quotation";
  return q.version > 1 ? `Quotation (revision ${q.version - 1})` : "Quotation";
}

/**
 * Itemized quotation with server-computed totals. The visit/inspection fee
 * is shown apart from repair charges; a price change shows its reason and
 * exactly what changed from the accepted quotation.
 */
export function QuotationCard({ quotation: q, audience }: { quotation: QuotationView; audience: "customer" | "technician" }) {
  const status = audience === "technician" && q.status === "submitted" ? "Waiting for the customer" : quotationStatusLabels[q.status];
  const repairLkr = q.labourLkr + q.materialsLkr + q.additionalLkr;
  return (
    <article className="rounded-lg border" aria-label={quotationTitle(q)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="font-semibold text-foreground">{quotationTitle(q)}</h3>
        <span className="text-sm text-muted-foreground">
          {status} · {formatDate(q.createdAt)}
          {q.status === "submitted" ? ` · valid until ${formatDate(q.validUntil)}` : ""}
        </span>
      </header>
      <div className="space-y-4 p-4 text-sm">
        {q.revisionReason ? (
          <div className="rounded-md border border-urgent/30 bg-urgent-soft px-3 py-2">
            <p className="font-medium text-foreground">Why the price changed</p>
            <p className="mt-0.5 break-words whitespace-pre-line text-foreground">{q.revisionReason}</p>
          </div>
        ) : null}
        {q.differences ? (
          <div>
            <p className="font-medium text-foreground">
              Change from the accepted quotation:{" "}
              <span className={q.differences.totalChangeLkr > 0 ? "text-urgent" : "text-success"}>
                {q.differences.totalChangeLkr >= 0 ? "+" : "−"}
                {formatLkr(Math.abs(q.differences.totalChangeLkr))}
              </span>
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {q.differences.added.map((l, i) => (
                <li key={`a${i}`}>Added: {l.description} ({formatLkr(l.amountLkr)})</li>
              ))}
              {q.differences.removed.map((l, i) => (
                <li key={`r${i}`}>Removed: {l.description} ({formatLkr(l.amountLkr)})</li>
              ))}
              {q.differences.changed.map((l, i) => (
                <li key={`c${i}`}>
                  Changed: {l.description} ({formatLkr(l.beforeLkr)} → {formatLkr(l.afterLkr)})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {q.inspectionFindings ? (
          <div>
            <p className="font-medium text-foreground">{q.mode === "quote_online" ? "On-site findings" : "Inspection findings"}</p>
            <p className="mt-1 break-words whitespace-pre-line text-muted-foreground">{q.inspectionFindings}</p>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left">
            <caption className="sr-only">Quotation items</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
                <th scope="col" className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.lineItems.map((line, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-foreground">{line.description}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{quotationLineKindLabels[line.kind]}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatLkr(line.unitPriceLkr)}</td>
                  <td className="py-2 text-right tabular-nums">{formatLkr(line.amountLkr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto max-w-xs space-y-1.5">
          <TotalRow label="Labour" value={q.labourLkr} />
          <TotalRow label="Materials" value={q.materialsLkr} />
          <TotalRow label="Additional charges" value={q.additionalLkr} />
          <div className="flex justify-between border-t pt-1.5 font-medium text-foreground">
            <dt>Repair charges</dt>
            <dd className="tabular-nums">{formatLkr(repairLkr)}</dd>
          </div>
          {q.mode !== "quote_online" ? (
            <TotalRow label={q.mode === "urgent" ? "Inspection fee (agreed)" : "Visit fee (agreed)"} value={q.inspectionFeeLkr} />
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold text-foreground">
            <dt>Total price</dt>
            <dd className="tabular-nums">{formatLkr(q.totalLkr)}</dd>
          </div>
        </dl>
        <dl className="grid gap-3 sm:grid-cols-2">
          {q.estimatedDurationHours ? <Detail label="Estimated time" value={`About ${q.estimatedDurationHours} hours`} /> : null}
          {q.exclusions ? <Detail label="Not included" value={q.exclusions} /> : null}
          {q.assumptions ? <Detail label="Based on" value={q.assumptions} /> : null}
          {q.notes ? <Detail label="Notes" value={q.notes} /> : null}
        </dl>
        {q.decisionReason ? (
          <p className="rounded-md bg-sand/50 px-3 py-2 text-foreground">
            <span className="font-medium">
              {q.status === "revision_requested" ? "Customer asked for a revision:" : "Customer's reason:"}
            </span>{" "}
            {q.decisionReason}
          </p>
        ) : null}
      </div>
    </article>
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

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatLkr(value)}</dd>
    </div>
  );
}

type Audience = "customer" | "technician";
const nextSteps: Record<BookingStatus, Record<Audience, string>> = {
  technician_assigned: {
    customer: "Check the inspection fee and arrival time below, then confirm the visit.",
    technician: "Waiting for the customer to confirm the visit and your inspection fee. Don't travel yet.",
  },
  visit_scheduled: {
    customer: "Your technician will come at the agreed time. Keep your phone nearby.",
    technician: "The visit is confirmed. Tap “I'm on my way” when you leave.",
  },
  en_route: {
    customer: "Your technician is on the way.",
    technician: "Tap “I've arrived” when you reach the address.",
  },
  inspecting: {
    customer: "The technician is inspecting. You'll receive an itemized quotation to approve before any repair starts.",
    technician: "Inspect the job, then send your findings with an itemized quotation. Don't start repairs yet.",
  },
  awaiting_customer_approval: {
    customer: "Review the quotation. Paid work starts only after you approve it.",
    technician: "Waiting for the customer to approve your quotation. Don't start paid work until they do.",
  },
  quote_rejected: {
    customer: "You asked for a revision. The technician can send a new quotation, or either of you can cancel.",
    technician: "The customer asked for a revision. Send a revised quotation, or cancel if you can't agree.",
  },
  confirmed: {
    customer: "The job is confirmed at the agreed price. Your technician will start the work.",
    technician: "The customer approved the price. You can start the work.",
  },
  work_in_progress: {
    customer: "Work is under way. Any price change needs your approval before extra work.",
    technician: "Mark the job completed when finished. If the scope changes, send a revised quotation first.",
  },
  completed: {
    customer: "The job is complete. Pay the agreed amount directly to your technician.",
    technician: "Job complete. Collect the agreed amount from the customer.",
  },
  cancelled: { customer: "This job was cancelled.", technician: "This job was cancelled." },
};

/** Quote Online differs before work: the price is already agreed, and the site may change it. */
const onlineSteps: Partial<Record<BookingStatus, Record<Audience, string>>> = {
  confirmed: {
    customer: "You selected this quotation. The technician will arrange the visit with you to do the work.",
    technician: "The customer selected your quotation. Arrange the visit, then tap “I'm on my way”.",
  },
  inspecting: {
    customer: "The technician is checking the site against the quoted scope. Any price change needs your approval.",
    technician:
      "Check the site matches the quoted scope. Start work if it does; if not, send a revised quotation with the reason before doing extra work.",
  },
};

export function NextSteps({ status, audience, mode }: { status: BookingStatus; audience: Audience; mode: BookingMode }) {
  const text = (mode === "quote_online" ? onlineSteps[status]?.[audience] : undefined) ?? nextSteps[status][audience];
  return (
    <p className="rounded-lg bg-sand/50 px-4 py-3 text-sm text-foreground">
      <span className="font-semibold">Next: </span>
      {text}
    </p>
  );
}

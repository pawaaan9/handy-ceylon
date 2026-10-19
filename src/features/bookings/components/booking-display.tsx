import { BadgeCheck, Briefcase, Check, MapPin, Phone, Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatLkr, formatLocalMobile, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

import { bookingStatusLabels, quotationLineKindLabels, type BookingStatus, type QuotationStatus } from "../types";
import type { QuotationView, TechnicianPublicView } from "../views";

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

const progress: { label: string; statuses: BookingStatus[] }[] = [
  { label: "Technician assigned", statuses: ["technician_assigned"] },
  { label: "Visit confirmed", statuses: ["visit_scheduled"] },
  { label: "On the way", statuses: ["en_route"] },
  { label: "Inspection", statuses: ["inspecting"] },
  { label: "Quotation", statuses: ["awaiting_customer_approval", "quote_rejected"] },
  { label: "Job confirmed", statuses: ["confirmed"] },
  { label: "Work in progress", statuses: ["work_in_progress"] },
  { label: "Completed", statuses: ["completed"] },
];

/** Where the job is in the Get Help Now lifecycle. */
export function BookingProgress({ status, cancelledFrom }: { status: BookingStatus; cancelledFrom?: BookingStatus }) {
  const effective = status === "cancelled" ? cancelledFrom : status;
  const currentIndex = progress.findIndex((p) => effective && p.statuses.includes(effective));
  return (
    <ol className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8" aria-label="Job progress">
      {progress.map((p, i) => {
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

/** The verified technician, as the customer sees them. */
export function TechnicianCard({ technician }: { technician: TechnicianPublicView }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar className="size-16 border">
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
        {technician.skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
            {technician.skills.slice(0, 8).map((skill) => (
              <li key={skill} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-primary">
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
        {technician.approvedAt ? (
          <p className="text-xs text-muted-foreground">Verified since {formatDate(technician.approvedAt)}</p>
        ) : null}
      </div>
    </div>
  );
}

const quotationStatusLabels: Record<QuotationStatus, string> = {
  submitted: "Awaiting your decision",
  accepted: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  superseded: "Replaced",
  expired: "Expired",
};

/** Itemized quotation with server-computed totals. */
export function QuotationCard({ quotation, audience }: { quotation: QuotationView; audience: "customer" | "technician" }) {
  const status =
    audience === "technician" && quotation.status === "submitted" ? "Waiting for the customer" : quotationStatusLabels[quotation.status];
  return (
    <article className="rounded-lg border" aria-label={`Quotation version ${quotation.version}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="font-semibold text-foreground">
          Quotation{quotation.version > 1 ? ` (revision ${quotation.version - 1})` : ""}
        </h3>
        <span className="text-sm text-muted-foreground">
          {status} · {formatDate(quotation.createdAt)}
        </span>
      </header>
      <div className="space-y-4 p-4 text-sm">
        <div>
          <p className="font-medium text-foreground">Inspection findings</p>
          <p className="mt-1 break-words whitespace-pre-line text-muted-foreground">{quotation.inspectionFindings}</p>
        </div>
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
              {quotation.lineItems.map((line, i) => (
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
          <TotalRow label="Labour" value={quotation.labourLkr} />
          <TotalRow label="Materials" value={quotation.materialsLkr} />
          <TotalRow label="Additional charges" value={quotation.additionalLkr} />
          <TotalRow label="Inspection fee (agreed)" value={quotation.inspectionFeeLkr} />
          <div className="flex justify-between border-t pt-2 text-base font-semibold text-foreground">
            <dt>Total price</dt>
            <dd className="tabular-nums">{formatLkr(quotation.totalLkr)}</dd>
          </div>
        </dl>
        {quotation.estimatedDurationHours ? (
          <p className="text-muted-foreground">Estimated time: about {quotation.estimatedDurationHours} hours</p>
        ) : null}
        {quotation.notes ? <p className="break-words whitespace-pre-line text-muted-foreground">{quotation.notes}</p> : null}
        {quotation.rejectionReason ? (
          <p className="rounded-md bg-sand/50 px-3 py-2 text-foreground">
            <span className="font-medium">Customer&apos;s reason for rejecting:</span> {quotation.rejectionReason}
          </p>
        ) : null}
      </div>
    </article>
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

const nextSteps: Record<BookingStatus, { customer: string; technician: string }> = {
  technician_assigned: {
    customer: "Check the inspection fee and arrival time below, then confirm the visit.",
    technician: "Waiting for the customer to confirm the visit and your inspection fee. Don't travel yet.",
  },
  visit_scheduled: {
    customer: "Your technician will set off shortly. Keep your phone nearby.",
    technician: "The customer confirmed. Tap “I'm on my way” when you leave.",
  },
  en_route: {
    customer: "Your technician is on the way.",
    technician: "Tap “I've arrived” when you reach the address to start the inspection.",
  },
  inspecting: {
    customer: "The technician is inspecting. You'll receive an itemized quotation to approve before any repair starts.",
    technician: "Inspect the problem, then send your findings with an itemized quotation. Don't start repairs yet.",
  },
  awaiting_customer_approval: {
    customer: "Review the quotation. Work starts only after you approve it.",
    technician: "Waiting for the customer to approve your quotation. Don't start work until they do.",
  },
  quote_rejected: {
    customer: "You rejected the quotation. The technician can send a revised one, or either of you can cancel.",
    technician: "The customer rejected the quotation. Send a revised quotation, or cancel if you can't agree.",
  },
  confirmed: {
    customer: "The job is confirmed at the agreed price. Your technician will start the work.",
    technician: "The customer approved the quotation. You can start the work now.",
  },
  work_in_progress: {
    customer: "Work is under way. Your technician will mark it complete when done.",
    technician: "Mark the job completed when the work is finished.",
  },
  completed: {
    customer: "The job is complete. Pay the agreed amount directly to your technician.",
    technician: "Job complete. Collect the agreed amount from the customer.",
  },
  cancelled: { customer: "This job was cancelled.", technician: "This job was cancelled." },
};

export function NextSteps({ status, audience }: { status: BookingStatus; audience: "customer" | "technician" }) {
  return (
    <p className="rounded-lg bg-sand/50 px-4 py-3 text-sm text-foreground">
      <span className="font-semibold">Next: </span>
      {nextSteps[status][audience]}
    </p>
  );
}

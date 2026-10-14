import { CircleCheck, CircleDot, CircleX, Clock, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

import { applicationStatusLabels, type TechnicianApplicationStatus } from "../types";

const steps = [
  { key: "submitted", label: "Application submitted" },
  { key: "review", label: "Under review" },
  { key: "decision", label: "Decision" },
] as const;

const tone: Record<TechnicianApplicationStatus, string> = {
  pending: "bg-muted text-foreground",
  under_review: "bg-brand-soft text-primary",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const icons = { pending: Clock, under_review: Search, approved: CircleCheck, rejected: CircleX } as const;

export function ApplicationStatusBadge({ status }: { status: TechnicianApplicationStatus }) {
  const Icon = icons[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", tone[status])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {applicationStatusLabels[status]}
    </span>
  );
}

export function ApplicationTimeline({
  status,
  submittedAt,
  reviewedAt,
}: {
  status: TechnicianApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
}) {
  const reached = {
    submitted: true,
    review: status !== "pending",
    decision: status === "approved" || status === "rejected",
  };
  const detail = {
    submitted: formatDate(submittedAt),
    review: status === "pending" ? "Waiting for a reviewer" : "Documents and details checked",
    decision:
      status === "approved" || status === "rejected"
        ? `${applicationStatusLabels[status]}${reviewedAt ? ` · ${formatDate(reviewedAt)}` : ""}`
        : "Waiting for a decision",
  };
  return (
    <ol className="space-y-4">
      {steps.map((step) => {
        const done = reached[step.key];
        const failed = step.key === "decision" && status === "rejected";
        const Icon = failed ? CircleX : done ? CircleCheck : CircleDot;
        return (
          <li key={step.key} className="flex gap-3">
            <Icon
              className={cn(
                "mt-0.5 size-5 shrink-0",
                failed ? "text-destructive" : done ? "text-primary" : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
            <div>
              <p className={cn("text-sm font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </p>
              <p className="text-sm text-muted-foreground">{detail[step.key]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

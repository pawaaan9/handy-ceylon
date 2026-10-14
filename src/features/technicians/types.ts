import type { Transition } from "@/lib/state-machine";

export const technicianApplicationStatuses = [
  "pending", // submitted, waiting for an administrator
  "under_review", // an administrator is checking documents / references
  "approved", // technician role granted
  "rejected", // applicant may correct and resubmit
] as const;
export type TechnicianApplicationStatus = (typeof technicianApplicationStatuses)[number];

/**
 * Only administrators decide; applicants may only resubmit after rejection.
 * Approval is final here — suspensions are handled on the technician profile.
 */
export const applicationTransitions: readonly Transition<TechnicianApplicationStatus>[] = [
  { from: "pending", to: "under_review", actors: ["admin"] },
  { from: "pending", to: "approved", actors: ["admin"] },
  { from: "pending", to: "rejected", actors: ["admin"] },
  { from: "under_review", to: "approved", actors: ["admin"] },
  { from: "under_review", to: "rejected", actors: ["admin"] },
  { from: "rejected", to: "pending", actors: ["applicant"] },
];

export const applicationStatusLabels: Record<TechnicianApplicationStatus, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Not approved",
};

import type { UserRole } from "@/features/auth/roles";
import type { Urgency } from "@/features/requests/types";
import type { QuotationDoc } from "@/lib/firestore/models";

import type { BookingStep } from "./schemas";
import type { CancellationOutcome } from "./state-machine";
import type { BookingMode, BookingStatus, QuotationStatus } from "./types";

/** Serialisable views for pages and client components (Timestamps → ISO strings). */

/** What an eligible technician sees before accepting — never the precise address or contact. */
export type AvailableRequestView = {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  serviceName: string;
  city: string;
  district: string;
  urgency: Urgency;
  attachmentCount: number;
  createdAt: string;
  expiresAt: string;
};

/** A verified technician as shown to the customer they're working for. */
export type TechnicianPublicView = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null; // only while the booking is active
  verified: boolean;
  approvedAt: string | null;
  yearsOfExperience: number;
  skills: string[];
  city: string;
  district: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
};

export type QuotationView = Pick<
  QuotationDoc,
  | "version"
  | "inspectionFindings"
  | "lineItems"
  | "labourLkr"
  | "materialsLkr"
  | "additionalLkr"
  | "inspectionFeeLkr"
  | "totalLkr"
  | "estimatedDurationHours"
  | "notes"
  | "rejectionReason"
> & { id: string; status: QuotationStatus; createdAt: string; decidedAt: string | null };

export type BookingSummaryView = {
  id: string;
  requestId: string;
  mode: BookingMode;
  status: BookingStatus;
  title: string;
  serviceName: string;
  city: string;
  district: string;
  inspectionFeeLkr: number;
  agreedTotalLkr: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BookingView = BookingSummaryView & {
  customerId: string;
  technicianId: string;
  etaMinutes: number | null;
  technicianMessage: string | null;
  visitConfirmedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  confirmedAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  quotationCount: number;
  cancellation: {
    by: "customer" | "technician" | "admin";
    reason: string;
    fromStatus: BookingStatus;
    inspectionFeeDue: boolean;
    at: string;
  } | null;
  technician: TechnicianPublicView | null;
  quotations: QuotationView[]; // newest first
  history: { from: BookingStatus | null; to: BookingStatus; actorRole: UserRole | "system"; note: string | null; at: string }[];
  /** What the viewer may do next, decided on the server from the state machine. */
  allowed: {
    steps: BookingStep[];
    submitQuotation: boolean;
    decideQuotationId: string | null;
    cancel: CancellationOutcome | null;
  };
};

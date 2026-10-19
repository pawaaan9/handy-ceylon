import type { UserRole } from "@/features/auth/roles";
import type { PreferredSchedule, Urgency } from "@/features/requests/types";
import type { PaymentDoc, QuotationDoc } from "@/lib/firestore/models";

import type { BookingStep, VisitSlot } from "./schemas";
import type { CancellationOutcome } from "./state-machine";
import type { BookingMode, BookingStatus, OfferStatus, QuotationStatus } from "./types";

/** Serialisable views for pages and client components (Timestamps → ISO strings). */

/** What a technician's own response to a request is, for lists. */
export type MyResponse = "offer_pending" | "quote_submitted" | null;

/** What an eligible technician sees before taking a job — never the precise address or contact. */
export type AvailableRequestView = {
  id: string;
  mode: BookingMode;
  title: string;
  description: string;
  categoryName: string;
  serviceName: string;
  city: string;
  district: string;
  urgency: Urgency;
  preferredSchedule: PreferredSchedule;
  attachmentCount: number;
  myResponse: MyResponse;
  createdAt: string;
  expiresAt: string;
};

/** A verified technician as shown to a customer. */
export type TechnicianPublicView = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null; // only to the customer of an active booking
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
  | "mode"
  | "technicianId"
  | "inspectionFindings"
  | "lineItems"
  | "labourLkr"
  | "materialsLkr"
  | "additionalLkr"
  | "inspectionFeeLkr"
  | "totalLkr"
  | "estimatedDurationHours"
  | "exclusions"
  | "assumptions"
  | "notes"
  | "revisionOfQuotationId"
  | "revisionReason"
  | "differences"
  | "decisionReason"
> & {
  id: string;
  status: QuotationStatus; // "expired" if validUntil passed while still submitted
  createdAt: string;
  validUntil: string;
  decidedAt: string | null;
  acceptedAt: string | null;
};

/** Technician Visit: one technician's offer, for the customer to compare. */
export type VisitOfferView = {
  technicianId: string;
  status: OfferStatus;
  inspectionFeeLkr: number;
  proposedVisits: VisitSlot[];
  chosenVisit: VisitSlot | null;
  message: string | null;
  conversationId: string | null;
  createdAt: string;
  technician: TechnicianPublicView | null;
};

/** Quote Online: one technician's quotation with their profile, for comparison. */
export type RemoteQuotationView = QuotationView & {
  conversationId: string | null;
  technician: TechnicianPublicView | null;
};

/** A request as an eligible (or responding) technician sees it, without the address. */
export type TechnicianRequestView = AvailableRequestView & {
  status: string;
  measurements: string | null;
  siteConditions: string | null;
  attachments: { name: string; kind: "image" | "video"; url: string | null }[];
  /** Why this technician can't respond now, or null if they can. */
  blockedReason: string | null;
  myOffer: VisitOfferView | null;
  myQuotations: QuotationView[]; // newest first
  conversationId: string;
  bookingId: string | null; // set if this technician got the job
};

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
  scheduledVisit: VisitSlot | null;
  technicianMessage: string | null;
  visitConfirmedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  confirmedAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  quotationCount: number;
  acceptedQuotationId: string | null;
  conversationId: string | null;
  cancellation: {
    by: "customer" | "technician" | "admin";
    reason: string;
    fromStatus: BookingStatus;
    inspectionFeeDue: boolean;
    at: string;
  } | null;
  payment: Pick<PaymentDoc, "status" | "visitFeeLkr" | "repairChargesLkr" | "totalDueLkr"> | null;
  technician: TechnicianPublicView | null;
  quotations: QuotationView[]; // newest first
  history: { from: BookingStatus | null; to: BookingStatus; actorRole: UserRole | "system"; note: string | null; at: string }[];
  /** What the viewer may do next, decided on the server from the state machine. */
  allowed: {
    steps: BookingStep[];
    submitQuotation: boolean;
    /** A revision of an accepted quotation must give a reason and shows the differences. */
    quotationIsPriceChange: boolean;
    decideQuotationId: string | null;
    cancel: CancellationOutcome | null;
  };
};

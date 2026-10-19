import type { BookingMode, BookingStatus, ServiceRequestStatus } from "@/features/bookings/types";
import type { UserRole } from "@/features/auth/roles";
import type { AddressSnapshot, RequestAttachment } from "@/lib/firestore/models";

import type { CancellationReason, PreferredSchedule, Urgency } from "./types";

/** Serialisable request views for pages and client components (Timestamps → ISO strings). */
export type RequestSummaryView = {
  id: string;
  mode: BookingMode;
  status: ServiceRequestStatus;
  title: string;
  categoryName: string;
  serviceName: string;
  city: string;
  district: string;
  urgency: Urgency;
  preferredSchedule: PreferredSchedule;
  attachmentCount: number;
  bookingId: string | null;
  bookingStatus: BookingStatus | null;
  createdAt: string;
};

export type RequestDetailView = RequestSummaryView & {
  categoryId: string;
  subcategoryName: string | null;
  description: string;
  measurements: string | null;
  siteConditions: string | null;
  address: AddressSnapshot | null;
  accessInstructions: string | null;
  attachments: (RequestAttachment & { url: string | null })[];
  cancellation: { by: string; reason: CancellationReason | "booking_cancelled"; note: string | null; at: string } | null;
  history: { from: ServiceRequestStatus | null; to: ServiceRequestStatus; actorRole: UserRole | "system"; note: string | null; at: string }[];
  expiresAt: string;
  selectedTechnicianId: string | null;
  canCancel: boolean;
};

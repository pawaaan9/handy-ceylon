import type { UserRole } from "@/features/auth/roles";
import type {
  BookingMode,
  BookingStatus,
  OfferStatus,
  QuotationStatus,
  ServiceRequestStatus,
} from "@/features/bookings/types";
import type { sriLankaDistricts } from "@/features/bookings/schemas";

/**
 * Firestore document shapes. Field-level write ownership is noted per field:
 *   [server]  — written only via the Admin SDK (rules deny client writes)
 *   [owner]   — the document owner may update it directly (rules enforce the field list)
 * Full relationships and rules: docs/ARCHITECTURE.md.
 */

/** Works for both the web SDK and Admin SDK Timestamp classes. */
export type Timestamp = { toDate(): Date; toMillis(): number };
export type District = (typeof sriLankaDistricts)[number];
export type LkrCents = number;

export type GeoLocation = { lat: number; lng: number; geohash: string };

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  district: District;
  location: GeoLocation;
};

/** users/{uid} */
export type UserDoc = {
  uid: string;
  role: UserRole; // [server] mirrors the custom claim
  status: "active" | "suspended"; // [server]
  displayName: string; // [owner]
  photoURL: string | null; // [owner]
  email: string | null; // [server]
  phone: string; // [server] E.164, verified later via OTP
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** customerProfiles/{uid} */
export type CustomerProfileDoc = {
  uid: string;
  savedAddresses: Address[]; // [owner]
  defaultAddressId: string | null; // [owner]
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** technicianProfiles/{uid} — public once approved. */
export type TechnicianProfileDoc = {
  uid: string;
  displayName: string;
  bio: string; // [owner]
  categoryIds: string[]; // [owner] → serviceCategories
  serviceDistricts: District[]; // [owner]
  availability: "online" | "offline"; // [owner]
  baseLocation?: GeoLocation; // [server] used for nearby matching
  verificationStatus: "pending" | "approved" | "rejected" | "suspended"; // [server]
  ratingAverage: number; // [server] aggregated from reviews
  ratingCount: number; // [server]
  completedJobs: number; // [server]
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** technicianPrivate/{uid} — identity documents; owner + admin only. */
export type TechnicianPrivateDoc = {
  uid: string;
  nicNumber: string;
  documentPaths: string[]; // Storage: technicianDocuments/{uid}/...
  reviewNotes?: string; // admin only
};

/** serviceCategories/{categoryId} — public catalogue, admin-managed. */
export type ServiceCategoryDoc = {
  slug: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  active: boolean;
  sortOrder: number;
};

/** serviceRequests/{requestId} — all [server]. Precise address lives in ./private/location. */
export type ServiceRequestDoc = {
  customerId: string;
  categoryId: string;
  mode: BookingMode;
  status: ServiceRequestStatus;
  title: string;
  description: string;
  city: string;
  district: District;
  approxGeohash: string; // ~1 km precision for technician matching
  media: { storagePath: string; contentType: string }[];
  measurements?: string;
  preferredWindow?: { start: Timestamp; end: Timestamp };
  selectedTechnicianId: string | null;
  acceptedQuotationId: string | null;
  bookingId: string | null;
  offerCount: number;
  quotationCount: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** serviceRequests/{requestId}/offers/{technicianId} — urgent acceptances & inspection-fee offers. */
export type OfferDoc = {
  technicianId: string;
  status: OfferStatus;
  inspectionFeeCents: LkrCents | null;
  etaMinutes: number | null;
  message: string | null;
  createdAt: Timestamp;
};

/** quotations/{quotationId} — top level so technicians can list their own. */
export type QuotationDoc = {
  requestId: string;
  bookingId: string | null; // null for quote_online until accepted
  customerId: string;
  technicianId: string;
  mode: BookingMode;
  status: QuotationStatus;
  version: number;
  previousQuotationId: string | null;
  lineItems: { description: string; quantity: number; unitPriceCents: LkrCents }[];
  subtotalCents: LkrCents; // [server] computed, never trusted from client
  totalCents: LkrCents; // [server]
  notes: string | null;
  estimatedDurationHours: number | null;
  validUntil: Timestamp;
  createdAt: Timestamp;
  decidedAt: Timestamp | null;
};

/** bookings/{bookingId} — created when a technician is assigned. */
export type BookingDoc = {
  requestId: string;
  customerId: string;
  technicianId: string;
  participantIds: [customerId: string, technicianId: string];
  mode: BookingMode;
  categoryId: string;
  status: BookingStatus;
  inspectionFeeCents: LkrCents | null;
  acceptedQuotationId: string | null;
  scheduledFor: Timestamp | null; // null = as soon as possible (urgent)
  conversationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
};

/** bookings/{bookingId}/statusHistory/{eventId} — append-only audit log. */
export type BookingStatusEventDoc = {
  from: BookingStatus | null;
  to: BookingStatus;
  actorId: string;
  actorRole: UserRole | "system";
  note: string | null;
  at: Timestamp;
};

/** conversations/{conversationId} */
export type ConversationDoc = {
  participantIds: string[];
  bookingId: string | null;
  requestId: string;
  lastMessagePreview: string | null;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp;
};

/** conversations/{conversationId}/messages/{messageId} — participants create directly. */
export type MessageDoc = {
  senderId: string;
  body: string;
  attachmentPath: string | null;
  createdAt: Timestamp;
};

/** users/{uid}/notifications/{notificationId} */
export type NotificationDoc = {
  type:
    | "request_offer"
    | "quotation_received"
    | "quotation_decided"
    | "booking_status"
    | "message"
    | "review_received"
    | "account";
  title: string;
  body: string;
  link: string | null;
  read: boolean; // [owner] the only client-writable field
  createdAt: Timestamp;
};

/** reviews/{bookingId} — one per completed booking, public. */
export type ReviewDoc = {
  bookingId: string;
  customerId: string;
  technicianId: string;
  categoryId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createdAt: Timestamp;
};

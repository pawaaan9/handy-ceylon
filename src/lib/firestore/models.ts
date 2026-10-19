import type { AccountStatus, UserRole } from "@/features/auth/roles";

import type {
  BookingMode,
  BookingStatus,
  OfferStatus,
  QuotationLineKind,
  QuotationStatus,
  ServiceRequestStatus,
} from "@/features/bookings/types";
import type { sriLankaDistricts } from "@/features/bookings/schemas";
import type {
  AttachmentKind,
  CancellationReason,
  PreferredSchedule,
  Urgency,
} from "@/features/requests/types";
import type { TechnicianApplicationStatus } from "@/features/technicians/types";

/**
 * Firestore document shapes. Field-level write ownership is noted per field:
 *   [server]  — written only via the Admin SDK (rules deny client writes)
 *   [owner]   — the document owner may update it directly (rules enforce the field list)
 * Full relationships and rules: docs/ARCHITECTURE.md.
 */

/** Works for both the web SDK and Admin SDK Timestamp classes. */
export type Timestamp = { toDate(): Date; toMillis(): number };
export type District = (typeof sriLankaDistricts)[number];
/** Whole Sri Lankan rupees, always an integer. */
export type Lkr = number;

export type GeoLocation = { lat: number; lng: number; geohash: string };

/** customers/{uid}/addresses/{addressId} — written only by the server. */
export type AddressDoc = {
  label: string;
  recipientName: string;
  contactNumber: string; // E.164 (+94…)
  houseOrBuilding: string;
  street: string;
  city: string;
  district: District;
  postalCode: string | null;
  directions: string | null;
  location: { lat: number; lng: number } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Copy of an address stored on a service request when it is created, so the
 * request keeps working even if the customer later edits or deletes the
 * saved address.
 */
export type AddressSnapshot = Omit<AddressDoc, "createdAt" | "updatedAt"> & { addressId: string };

/**
 * Fields shared by every account document. Each role has its own collection
 * (customers, technicians, admins); all are written only by the server.
 * Email verification is NOT mirrored here — read it from Firebase Auth.
 */
export type AccountBase = {
  uid: string;
  accountStatus: AccountStatus;
  displayName: string;
  email: string | null; // null for mobile-only sign-ups until they link an email
  phoneNumber: string | null; // E.164; unique via phoneIndex
  photoURL: string | null; // download URL of avatars/{uid}/*, set by the server
  photoPath: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** customers/{uid} — every public sign-up starts here. */
export type CustomerDoc = AccountBase & {
  phoneNumber: string;
  defaultAddressId: string | null; // → ./addresses/{addressId}
  termsAcceptedAt: Timestamp;
};

/** admins/{uid} — created only by scripts/grant-admin.mjs. */
export type AdminDoc = AccountBase & {
  grantedAt: Timestamp;
  grantedBy: string; // "grant-admin-script"
};

/** phoneIndex/{E.164} — server-only uniqueness index. */
export type PhoneIndexDoc = { uid: string; createdAt: Timestamp };

/** technicianApplications/{uid} — one per applicant; written only by the server. */
export type TechnicianApplicationDoc = {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  photoURL: string;
  professionalIntroduction: string;
  yearsOfExperience: number;
  serviceCategoryIds: string[];
  skills: string[];
  qualifications: string | null;
  serviceAreas: District[];
  district: District;
  city: string;
  qualificationDocumentPaths: string[]; // Storage: technicianDocuments/{uid}/...
  applicationStatus: TechnicianApplicationStatus;
  submissionCount: number;
  submittedAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null; // admin uid
  rejectionReason: string | null;
  updatedAt: Timestamp;
};

/**
 * technicians/{uid} — created when an admin approves an application. Holds the
 * account and the professional profile; private (owner + admin). Public
 * technician details are served by the server with contact fields removed.
 * The approved person's customers/{uid} document is kept (addresses etc.).
 */
export type TechnicianDoc = AccountBase & {
  phoneNumber: string;
  bio: string; // [owner]
  categoryIds: string[]; // [owner] → serviceCategories
  serviceDistricts: District[]; // [owner]
  skills: string[];
  yearsOfExperience: number;
  district: District;
  city: string;
  availability: "online" | "offline"; // [owner]
  baseLocation?: GeoLocation; // [server] used for nearby matching
  verificationStatus: "approved" | "suspended"; // [server]
  ratingAverage: number; // [server] aggregated from reviews
  ratingCount: number; // [server]
  completedJobs: number; // [server]
  approvedAt: Timestamp;
  approvedBy: string; // admin uid
};

/** serviceCategories/{slug} — public when active; managed by admins / seed script. */
export type ServiceCategoryDoc = {
  slug: string;
  name: string;
  description: string;
  icon: string; // name from features/catalogue/icons.ts
  imageURL: string | null;
  keywords: string[];
  active: boolean;
  sortOrder: number;
  subcategories: { id: string; name: string; sortOrder: number; active: boolean }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** services/{serviceId} — a bookable service within a category. */
export type ServiceDoc = {
  categoryId: string; // → serviceCategories
  subcategoryId: string | null; // → serviceCategories.subcategories[].id
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * serviceRequests/{requestId} — all [server]. The id is derived on the server
 * from the customer's uid and a per-submission key, so a retried or
 * double-clicked submission resolves to the same document.
 *
 * Technicians may read open requests (to respond in later phases), so this
 * document holds only the area (city/district). The precise address snapshot
 * and access instructions live in ./private/details.
 */
export type ServiceRequestDoc = {
  customerId: string;
  /** Booking method: urgent = Get Help Now; quote_visit / quote_online = Get a Quote options. */
  mode: BookingMode;
  status: ServiceRequestStatus;
  categoryId: string; // → serviceCategories
  serviceId: string; // → services; validated as active at creation
  /** Readable names captured at creation, so renamed or retired services still display. */
  catalogue: { categoryName: string; serviceName: string; subcategoryName: string | null };
  addressId: string; // the saved address used (may later be edited or deleted)
  city: string;
  district: District;
  title: string;
  description: string;
  urgency: Urgency;
  preferredSchedule: PreferredSchedule;
  measurements: string | null; // quote_online only
  /** Copied out of the customer's draft folder into serviceRequests/{requestId}/media/. */
  attachments: RequestAttachment[];
  selectedTechnicianId: string | null; // [server] set only when a technician is assigned
  acceptedQuotationId: string | null;
  bookingId: string | null; // the current booking, while assigned
  /** Mirror of bookings/{bookingId}.status, so lists don't need a second read. */
  bookingStatus: BookingStatus | null;
  offerCount: number;
  quotationCount: number;
  cancellation: {
    by: "customer" | "technician" | "admin" | "system";
    actorId: string | null;
    reason: CancellationReason | "booking_cancelled";
    note: string | null;
    at: Timestamp;
  } | null;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type RequestAttachment = {
  storagePath: string; // serviceRequests/{requestId}/media/{file}
  contentType: string; // from the stored object's metadata, not the client
  sizeBytes: number;
  kind: AttachmentKind;
  name: string;
};

/** serviceRequests/{requestId}/private/details — customer, assigned technician and admins only. */
export type ServiceRequestPrivateDoc = {
  address: AddressSnapshot;
  accessInstructions: string | null;
};

/** serviceRequests/{requestId}/history/{eventId} — append-only audit log. */
export type ServiceRequestEventDoc = {
  from: ServiceRequestStatus | null; // null for creation
  to: ServiceRequestStatus;
  actorId: string | null; // null for system events
  actorRole: UserRole | "system";
  note: string | null;
  at: Timestamp;
};

/** serviceRequests/{requestId}/offers/{technicianId} — one technician's response (urgent: accept / decline). */
export type OfferDoc = {
  technicianId: string;
  status: OfferStatus;
  inspectionFeeLkr: Lkr | null; // shown to the customer before they confirm the visit
  etaMinutes: number | null;
  message: string | null;
  bookingId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** quotations/{quotationId} — top level so technicians can list their own. All [server]. */
export type QuotationDoc = {
  requestId: string;
  bookingId: string;
  customerId: string;
  technicianId: string;
  mode: BookingMode;
  status: QuotationStatus;
  version: number; // 1, 2, 3 — a revision after rejection is a new version
  previousQuotationId: string | null;
  inspectionFindings: string;
  lineItems: {
    kind: QuotationLineKind;
    description: string;
    quantity: number;
    unitPriceLkr: Lkr;
    amountLkr: Lkr; // quantity × unitPriceLkr
  }[];
  labourLkr: Lkr; // [server] computed from lineItems, never trusted from the client
  materialsLkr: Lkr;
  additionalLkr: Lkr;
  inspectionFeeLkr: Lkr; // agreed when the customer confirmed the visit
  totalLkr: Lkr; // labour + materials + additional + inspection fee
  estimatedDurationHours: number | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: Timestamp;
  decidedAt: Timestamp | null;
};

/**
 * bookings/{bookingId} — one technician's job for one request, created when a
 * technician accepts. It becomes the confirmed job when the customer approves
 * a quotation. All [server]; status changes are appended to ./statusHistory.
 */
export type BookingDoc = {
  requestId: string;
  customerId: string;
  technicianId: string;
  participantIds: [customerId: string, technicianId: string];
  mode: BookingMode;
  categoryId: string;
  status: BookingStatus;
  /** Snapshot for lists. */
  summary: { title: string; serviceName: string; city: string; district: District };
  inspectionFeeLkr: Lkr; // 0 = free inspection
  etaMinutes: number | null;
  technicianMessage: string | null;
  visitConfirmedAt: Timestamp | null;
  enRouteAt: Timestamp | null;
  arrivedAt: Timestamp | null;
  currentQuotationId: string | null;
  quotationCount: number;
  acceptedQuotationId: string | null;
  agreedTotalLkr: Lkr | null;
  confirmedAt: Timestamp | null;
  workStartedAt: Timestamp | null;
  completedAt: Timestamp | null;
  cancellation: {
    by: "customer" | "technician" | "admin";
    actorId: string;
    reason: string;
    fromStatus: BookingStatus;
    inspectionFeeDue: boolean;
    at: Timestamp;
  } | null;
  conversationId: string | null; // messaging arrives in a later phase
  createdAt: Timestamp;
  updatedAt: Timestamp;
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

/** notifications/{uid}/items/{notificationId} — any role. */
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

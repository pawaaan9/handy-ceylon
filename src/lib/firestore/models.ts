import type { AccountStatus, UserRole } from "@/features/auth/roles";

import type {
  BookingMode,
  BookingStatus,
  OfferStatus,
  QuotationStatus,
  ServiceRequestStatus,
} from "@/features/bookings/types";
import type { sriLankaDistricts } from "@/features/bookings/schemas";
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
export type LkrCents = number;

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

/** serviceRequests/{requestId} — all [server]. Precise address lives in ./private/location. */
export type ServiceRequestDoc = {
  customerId: string;
  categoryId: string;
  serviceId: string | null; // → services; validated as active at creation
  addressId: string; // the saved address used (may later be edited or deleted)
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

/** serviceRequests/{requestId}/private/location — precise address, customer + assigned technician only. */
export type ServiceRequestPrivateDoc = { address: AddressSnapshot };

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

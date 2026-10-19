/**
 * Single source of truth for Firestore paths. Keep in sync with
 * firestore.rules and docs/ARCHITECTURE.md.
 */
export const collections = {
  /** One collection per role; a uid's role is the collection its account lives in. */
  customers: "customers",
  technicians: "technicians",
  admins: "admins",
  technicianApplications: "technicianApplications",
  /** phoneIndex/{E.164} → { uid }; enforces one account per mobile number. */
  phoneIndex: "phoneIndex",
  serviceCategories: "serviceCategories",
  /** services/{serviceId} — top level so search and selection can span categories. */
  services: "services",
  serviceRequests: "serviceRequests",
  quotations: "quotations",
  bookings: "bookings",
  conversations: "conversations",
  reviews: "reviews",
  notifications: "notifications",
  /** payments/{bookingId} — amount owed per job; collection arrives in Phase 9. */
  payments: "payments",
} as const;

/** Fixed document ids inside subcollections. */
export const docIds = {
  requestPrivateDetails: "details",
} as const;

export const subcollections = {
  /** customers/{uid}/addresses/{addressId} */
  addresses: "addresses",
  /** serviceRequests/{requestId}/offers/{technicianId} */
  offers: "offers",
  /** serviceRequests/{requestId}/private/details */
  requestPrivate: "private",
  /** serviceRequests/{requestId}/history/{eventId} */
  requestHistory: "history",
  /** bookings/{bookingId}/statusHistory/{eventId} */
  statusHistory: "statusHistory",
  /** conversations/{conversationId}/messages/{messageId} */
  messages: "messages",
  /** notifications/{uid}/items/{notificationId} */
  notificationItems: "items",
} as const;

/** Cloud Storage paths. Keep in sync with storage.rules. */
export const storagePaths = {
  avatarPrefix: (uid: string) => `avatars/${uid}/`,
  technicianDocumentPrefix: (uid: string) => `technicianDocuments/${uid}/`,
  /** Customer-owned uploads for a request that hasn't been submitted yet. */
  requestDraftPrefix: (uid: string, submissionKey: string) => `requestMedia/${uid}/${submissionKey}/`,
  /** Server-owned copies attached to a submitted request. */
  requestMediaPrefix: (requestId: string) => `serviceRequests/${requestId}/media/`,
} as const;

import type { UserRole } from "@/features/auth/roles";

export const roleCollections = {
  customer: collections.customers,
  technician: collections.technicians,
  admin: collections.admins,
} as const satisfies Record<UserRole, string>;

/**
 * Single source of truth for Firestore paths. Keep in sync with
 * firestore.rules and docs/ARCHITECTURE.md.
 */
export const collections = {
  users: "users",
  customerProfiles: "customerProfiles",
  technicianApplications: "technicianApplications",
  technicianProfiles: "technicianProfiles",
  technicianPrivate: "technicianPrivate",
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
} as const;

export const subcollections = {
  /** customerProfiles/{uid}/addresses/{addressId} */
  addresses: "addresses",
  /** serviceRequests/{requestId}/offers/{technicianId} */
  offers: "offers",
  /** serviceRequests/{requestId}/private/location */
  requestPrivate: "private",
  /** bookings/{bookingId}/statusHistory/{eventId} */
  statusHistory: "statusHistory",
  /** conversations/{conversationId}/messages/{messageId} */
  messages: "messages",
  /** users/{uid}/notifications/{notificationId} */
  notifications: "notifications",
} as const;

/** Cloud Storage paths. Keep in sync with storage.rules. */
export const storagePaths = {
  avatarPrefix: (uid: string) => `users/${uid}/avatar/`,
  technicianDocumentPrefix: (uid: string) => `technicianDocuments/${uid}/`,
} as const;

/**
 * Single source of truth for Firestore paths. Keep in sync with
 * firestore.rules and docs/ARCHITECTURE.md.
 */
export const collections = {
  users: "users",
  customerProfiles: "customerProfiles",
  technicianProfiles: "technicianProfiles",
  technicianPrivate: "technicianPrivate",
  serviceCategories: "serviceCategories",
  serviceRequests: "serviceRequests",
  quotations: "quotations",
  bookings: "bookings",
  conversations: "conversations",
  reviews: "reviews",
} as const;

export const subcollections = {
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

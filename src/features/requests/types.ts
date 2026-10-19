import type { BookingMode, ServiceRequestStatus } from "@/features/bookings/types";

/**
 * The exact customer-facing booking options. `mode` is what is stored; the
 * labels are what customers see. Each option's own workflow (matching,
 * offers, quotations) is built in later phases on top of the common request.
 */
export const requestTypeOptions: readonly {
  mode: BookingMode;
  label: string;
  group: string | null;
  description: string;
}[] = [
  {
    mode: "urgent",
    label: "Get Help Now",
    group: null,
    description: "Something is broken now. A nearby technician comes as soon as possible.",
  },
  {
    mode: "quote_visit",
    label: "Technician Visit",
    group: "Get a Quote",
    description: "A technician inspects the job in person, then sends a detailed quotation.",
  },
  {
    mode: "quote_online",
    label: "Quote Online",
    group: "Get a Quote",
    description: "Share photos or videos and receive quotations without a visit.",
  },
];

/** "Get a Quote › Technician Visit" style label for summaries and lists. */
export function requestTypeLabel(mode: BookingMode): string {
  const option = requestTypeOptions.find((o) => o.mode === mode);
  if (!option) return mode;
  return option.group ? `${option.group} › ${option.label}` : option.label;
}

export const urgencyLevels = ["emergency", "high", "normal", "low"] as const;
export type Urgency = (typeof urgencyLevels)[number];

export const urgencyOptions: Record<Urgency, { label: string; description: string }> = {
  emergency: { label: "Emergency", description: "Safety risk or damage happening right now" },
  high: { label: "High", description: "Needs fixing within a day or two" },
  normal: { label: "Normal", description: "Within the next week" },
  low: { label: "Low", description: "Planned work, no rush" },
};

/** Get Help Now is for problems that can't wait. */
export const urgentModeUrgencies: readonly Urgency[] = ["emergency", "high"];

/** When the customer wants the work done. Get Help Now is always "asap". */
export const timings = ["asap", "scheduled", "flexible"] as const;
export type Timing = (typeof timings)[number];

export const timeSlots = ["morning", "afternoon", "evening"] as const;
export type TimeSlot = (typeof timeSlots)[number];

export const timeSlotLabels: Record<TimeSlot, string> = {
  morning: "Morning (8am – 12pm)",
  afternoon: "Afternoon (12pm – 4pm)",
  evening: "Evening (4pm – 8pm)",
};

/** How far ahead a customer can ask for a visit. */
export const MAX_SCHEDULE_DAYS_AHEAD = 60;

export type PreferredSchedule =
  | { kind: "asap" }
  | { kind: "flexible" }
  | { kind: "scheduled"; date: string; timeSlot: TimeSlot }; // date: YYYY-MM-DD, Asia/Colombo

export const cancellationReasons = [
  "no_longer_needed",
  "found_someone_else",
  "wrong_details",
  "other",
] as const;
export type CancellationReason = (typeof cancellationReasons)[number];

export const cancellationReasonLabels: Record<CancellationReason | "booking_cancelled", string> = {
  no_longer_needed: "I no longer need this",
  found_someone_else: "I found someone else",
  wrong_details: "I entered the wrong details",
  other: "Another reason",
  booking_cancelled: "The job was cancelled",
};

export const requestStatusLabels: Record<ServiceRequestStatus, string> = {
  open: "Waiting for a technician",
  assigned: "Technician assigned",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** Open requests stop accepting technicians after this long (checked whenever they're read or accepted). */
export const requestLifetimeHours: Record<BookingMode, number> = {
  urgent: 24,
  quote_visit: 7 * 24,
  quote_online: 7 * 24,
};

/** One customer can't flood technicians with open requests. */
export const MAX_OPEN_REQUESTS = 10;

// ── Attachments ─────────────────────────────────────────────────────────────

export const MAX_ATTACHMENTS = 6;
export const MAX_VIDEOS = 2;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** Checked in the browser from the video's metadata; size is enforced everywhere. */
export const MAX_VIDEO_SECONDS = 60;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type AttachmentKind = "image" | "video";

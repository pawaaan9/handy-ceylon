import { z } from "zod";

import { addressIdSchema } from "@/features/addresses/schemas";
import { bookingModes, type BookingMode } from "@/features/bookings/types";
import { catalogueSlugSchema } from "@/features/catalogue/types";

import {
  cancellationReasons,
  IMAGE_TYPES,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_SCHEDULE_DAYS_AHEAD,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS,
  timeSlots,
  timings,
  urgencyLevels,
  urgencyOptions,
  urgentModeUrgencies,
  VIDEO_TYPES,
  type AttachmentKind,
  type PreferredSchedule,
} from "./types";

// ── Attachments ─────────────────────────────────────────────────────────────

export function attachmentKind(contentType: string): AttachmentKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(contentType)) return "video";
  return null;
}

/**
 * Shared file check: the browser runs it before uploading and the server runs
 * it again on the stored object's real metadata. Returns a message or null.
 */
export function validateAttachmentFile(file: { type: string; size: number }): string | null {
  const kind = attachmentKind(file.type);
  if (!kind) return "Use a JPG, PNG, WebP or HEIC photo, or an MP4, MOV or WebM video.";
  if (file.size <= 0) return "This file is empty.";
  if (kind === "image" && file.size > MAX_IMAGE_BYTES) return "Photos must be 10 MB or smaller.";
  if (kind === "video" && file.size > MAX_VIDEO_BYTES) return "Videos must be 50 MB or smaller.";
  return null;
}

/** What the browser reports about an upload; the server re-reads the real object. */
export const attachmentSchema = z.object({
  storagePath: z.string().min(1).max(300),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120),
});
export type AttachmentInput = z.infer<typeof attachmentSchema>;

// ── Dates (Asia/Colombo) ────────────────────────────────────────────────────

const colomboDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Sri Lanka as YYYY-MM-DD, whatever the server's time zone. */
export function colomboToday(now = new Date()): string {
  return colomboDate.format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value; // rejects 2026-02-30 etc.
}

// ── Field schemas ───────────────────────────────────────────────────────────

/** Client-generated key for one submission attempt; makes retries idempotent. */
export const submissionKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid submission");
export const requestIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid request");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

const modeSchema = z.enum(bookingModes, { error: "Choose how you'd like to book" });

const serviceShape = {
  mode: modeSchema,
  categoryId: z.string().min(1, "Choose a service category").pipe(catalogueSlugSchema),
  serviceId: z.string().min(1, "Choose the service you need").pipe(catalogueSlugSchema),
};

const addressShape = {
  addressId: z.string().min(1, "Choose where the technician should come").pipe(addressIdSchema),
};

const detailsShape = {
  title: z
    .string()
    .trim()
    .min(5, "Give the job a short title (at least 5 characters)")
    .max(100, "Keep the title under 100 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Describe the problem in at least 20 characters")
    .max(2000, "Keep the description under 2000 characters"),
  urgency: z.enum(urgencyLevels, { error: "Choose how urgent this is" }),
  timing: z.enum(timings, { error: "Choose when you need this done" }),
  preferredDate: z.string().trim(),
  preferredTimeSlot: z.union([z.literal(""), z.enum(timeSlots)]),
  accessInstructions: optionalText(500, "Keep access instructions under 500 characters"),
  measurements: optionalText(1000, "Keep measurements under 1000 characters"),
};

const attachmentsShape = {
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS, `Attach up to ${MAX_ATTACHMENTS} files`),
};

// ── Cross-field rules ───────────────────────────────────────────────────────

type DetailsValues = { mode: BookingMode } & {
  urgency: (typeof urgencyLevels)[number];
  timing: (typeof timings)[number];
  preferredDate: string;
  preferredTimeSlot: string;
};

function checkDetails(v: DetailsValues, ctx: z.RefinementCtx) {
  if (v.mode === "urgent") {
    if (!urgentModeUrgencies.includes(v.urgency)) {
      ctx.addIssue({
        code: "custom",
        path: ["urgency"],
        message: `Get Help Now is for ${urgentModeUrgencies
          .map((u) => urgencyOptions[u].label.toLowerCase())
          .join(" or ")} jobs. For planned work, choose Get a Quote.`,
      });
    }
    if (v.timing !== "asap") {
      ctx.addIssue({ code: "custom", path: ["timing"], message: "Get Help Now visits are as soon as possible." });
    }
    return;
  }

  if (v.timing === "asap") {
    ctx.addIssue({
      code: "custom",
      path: ["timing"],
      message: "Pick a date or choose flexible. For help right away, use Get Help Now.",
    });
  }
  if (v.timing !== "scheduled") return;

  const today = colomboToday();
  if (!isRealDate(v.preferredDate)) {
    ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred date" });
  } else if (v.preferredDate < today) {
    ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose today or a later date" });
  } else if (v.preferredDate > addDays(today, MAX_SCHEDULE_DAYS_AHEAD)) {
    ctx.addIssue({
      code: "custom",
      path: ["preferredDate"],
      message: `Choose a date within the next ${MAX_SCHEDULE_DAYS_AHEAD} days`,
    });
  }
  if (!v.preferredTimeSlot) {
    ctx.addIssue({ code: "custom", path: ["preferredTimeSlot"], message: "Choose a preferred time" });
  }
}

function checkAttachments(v: { mode: BookingMode; attachments: AttachmentInput[] }, ctx: z.RefinementCtx) {
  if (v.mode === "quote_online" && v.attachments.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["attachments"],
      message: "Quote Online needs at least one photo or video so technicians can price the job.",
    });
  }
  if (v.attachments.filter((a) => attachmentKind(a.contentType) === "video").length > MAX_VIDEOS) {
    ctx.addIssue({ code: "custom", path: ["attachments"], message: `Attach up to ${MAX_VIDEOS} videos` });
  }
  if (new Set(v.attachments.map((a) => a.storagePath)).size !== v.attachments.length) {
    ctx.addIssue({ code: "custom", path: ["attachments"], message: "The same file is attached twice" });
  }
}

// ── Schemas ─────────────────────────────────────────────────────────────────

/** Per-step checks for the multi-step form; the server always runs the full schema. */
export const requestStepSchemas = {
  service: z.object(serviceShape),
  address: z.object(addressShape),
  details: z.object({ mode: modeSchema, ...detailsShape }).superRefine(checkDetails),
  attachments: z.object({ mode: modeSchema, ...attachmentsShape }).superRefine(checkAttachments),
};
export type RequestStep = keyof typeof requestStepSchemas;

export const createServiceRequestSchema = z
  .object({
    submissionKey: submissionKeySchema,
    ...serviceShape,
    ...addressShape,
    ...detailsShape,
    ...attachmentsShape,
  })
  .superRefine((v, ctx) => {
    checkDetails(v, ctx);
    checkAttachments(v, ctx);
  })
  .transform(({ timing, preferredDate, preferredTimeSlot, measurements, ...rest }) => ({
    ...rest,
    preferredSchedule: (timing === "scheduled"
      ? { kind: "scheduled", date: preferredDate, timeSlot: preferredTimeSlot }
      : { kind: timing }) as PreferredSchedule,
    // Measurements only make sense for remote quotes.
    measurements: rest.mode === "quote_online" ? measurements : null,
  }));

export type ServiceRequestFormValues = z.input<typeof createServiceRequestSchema>;
export type CreateServiceRequestInput = z.output<typeof createServiceRequestSchema>;

export const cancelServiceRequestSchema = z.object({
  requestId: requestIdSchema,
  reason: z.enum(cancellationReasons, { error: "Choose a reason" }),
  note: optionalText(300, "Keep the note under 300 characters"),
});
export type CancelServiceRequestFormValues = z.input<typeof cancelServiceRequestSchema>;
export type CancelServiceRequestInput = z.output<typeof cancelServiceRequestSchema>;

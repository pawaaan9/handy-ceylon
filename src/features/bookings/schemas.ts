import { z } from "zod";

import { timeSlots } from "@/features/requests/types";
import { addDays, colomboToday, isRealDate } from "@/lib/dates";

import { quotationLineKinds } from "./types";

/** Sri Lanka's 25 administrative districts. */
export const sriLankaDistricts = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle",
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle",
  "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
] as const;
export const districtSchema = z.enum(sriLankaDistricts, { error: "Select a district" });

// ── Money: whole Sri Lankan rupees, stored as integers ──────────────────────

export const MAX_INSPECTION_FEE_LKR = 25_000;
export const MAX_LINE_UNIT_PRICE_LKR = 5_000_000;
export const MAX_QUOTATION_TOTAL_LKR = 10_000_000;
export const MAX_QUOTATION_LINES = 30;
/** A quotation can be revised, but not endlessly (per technician, per job or request). */
export const MAX_QUOTATION_VERSIONS = 3;
export const MAX_PROPOSED_VISITS = 3;
export const MAX_VISIT_DAYS_AHEAD = 30;
export const MAX_QUOTE_VALID_DAYS = 30;
/** Quotations made on site (urgent / visit) stay open this long before expiring. */
export const ON_SITE_QUOTE_VALID_DAYS = 7;

/** Accepts form strings or numbers; anything but a whole, non-negative rupee amount fails. */
export const wholeRupees = (label: string, max: number) =>
  z
    .union([z.number(), z.string().trim().min(1, `Enter ${label}`)])
    .pipe(
      z.coerce
        .number<string | number>({ error: `Enter ${label} in rupees` })
        .int("Use whole rupees, without cents")
        .min(0, "Amounts can't be negative")
        .max(max, `Enter LKR ${max.toLocaleString("en-LK")} or less`),
    );

const docId = (message: string) => z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, message);
export const bookingIdSchema = docId("Invalid booking");
export const quotationIdSchema = docId("Invalid quotation");
const requestId = docId("Invalid request");
const uid = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid technician");
const submissionKey = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid submission");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

// ── Technician responses ────────────────────────────────────────────────────

export const acceptUrgentRequestSchema = z.object({
  requestId,
  /** 0 = free inspection. Shown to the customer before they confirm the visit. */
  inspectionFeeLkr: wholeRupees("an inspection fee (0 if free)", MAX_INSPECTION_FEE_LKR),
  etaMinutes: z.coerce
    .number<string | number>({ error: "Choose when you can arrive" })
    .int()
    .min(10, "Choose when you can arrive")
    .max(8 * 60, "Urgent visits must be within 8 hours"),
  message: optionalText(300, "Keep the message under 300 characters"),
});
export type AcceptUrgentRequestFormValues = z.input<typeof acceptUrgentRequestSchema>;
export type AcceptUrgentRequestInput = z.output<typeof acceptUrgentRequestSchema>;

export const declineUrgentRequestSchema = z.object({ requestId });

// ── Booking steps ───────────────────────────────────────────────────────────

/** Named steps rather than raw statuses: clients can't ask for an arbitrary status. */
export const bookingSteps = ["confirm_visit", "start_travel", "arrive", "start_work", "complete_work"] as const;
export type BookingStep = (typeof bookingSteps)[number];
export const bookingStepSchema = z.object({ bookingId: bookingIdSchema, step: z.enum(bookingSteps) });

export const cancelBookingSchema = z.object({
  bookingId: bookingIdSchema,
  reason: z.string().trim().min(5, "Tell us briefly why (at least 5 characters)").max(300, "Keep it under 300 characters"),
});
export type CancelBookingInput = z.output<typeof cancelBookingSchema>;

// ── Quotations ──────────────────────────────────────────────────────────────

export const quotationLineSchema = z.object({
  kind: z.enum(quotationLineKinds, { error: "Choose labour, materials or additional" }),
  description: z.string().trim().min(2, "Describe this item").max(200, "Keep it under 200 characters"),
  quantity: z.coerce
    .number<string | number>({ error: "Enter a quantity" })
    .int("Use a whole number")
    .min(1, "At least 1")
    .max(1000, "1000 or fewer"),
  unitPriceLkr: wholeRupees("a price", MAX_LINE_UNIT_PRICE_LKR),
});
export type QuotationLineInput = z.output<typeof quotationLineSchema>;

const lineItemsSchema = z
  .array(quotationLineSchema)
  .min(1, "Add at least one item")
  .max(MAX_QUOTATION_LINES, `Use ${MAX_QUOTATION_LINES} items or fewer`);

const optionalHours = z
  .union([z.literal(""), z.coerce.number<string | number>().int("Use whole hours").min(1).max(720)])
  .transform((v) => (v === "" ? null : v));

function checkTotal(v: { lineItems: QuotationLineInput[] }, ctx: z.RefinementCtx) {
  const work = v.lineItems.reduce((sum, l) => sum + l.quantity * l.unitPriceLkr, 0);
  if (work <= 0) {
    ctx.addIssue({ code: "custom", path: ["lineItems"], message: "The quotation total must be more than LKR 0" });
  } else if (work > MAX_QUOTATION_TOTAL_LKR) {
    ctx.addIssue({
      code: "custom",
      path: ["lineItems"],
      message: `Quotations must total LKR ${MAX_QUOTATION_TOTAL_LKR.toLocaleString("en-LK")} or less`,
    });
  }
}

/**
 * A quotation for a booking: the first one after an inspection, or a
 * revision. A revision of an already-accepted quotation (a price change)
 * must give a reason; the server enforces that because only it knows.
 */
export const submitQuotationSchema = z
  .object({
    bookingId: bookingIdSchema,
    /** Per-submission key so a retried submit can't create a second version. */
    submissionKey,
    inspectionFindings: z
      .string()
      .trim()
      .min(20, "Describe what you found in at least 20 characters")
      .max(2000, "Keep findings under 2000 characters"),
    lineItems: lineItemsSchema,
    estimatedDurationHours: optionalHours,
    notes: optionalText(1000, "Keep notes under 1000 characters"),
    revisionReason: optionalText(500, "Keep the reason under 500 characters").optional().default(""),
  })
  .superRefine(checkTotal);
export type SubmitQuotationFormValues = z.input<typeof submitQuotationSchema>;
export type SubmitQuotationInput = z.output<typeof submitQuotationSchema>;

/** Quote Online: an itemized quotation sent remotely, from the request's description and evidence. */
export const submitRemoteQuotationSchema = z
  .object({
    requestId,
    submissionKey,
    lineItems: lineItemsSchema,
    estimatedDurationHours: z.coerce
      .number<string | number>({ error: "Estimate how many hours the job takes" })
      .int("Use whole hours")
      .min(1, "At least 1 hour")
      .max(720, "720 hours or fewer"),
    exclusions: optionalText(1000, "Keep exclusions under 1000 characters"),
    assumptions: optionalText(1000, "Keep assumptions under 1000 characters"),
    notes: optionalText(1000, "Keep notes under 1000 characters"),
    validForDays: z.coerce
      .number<string | number>({ error: "Choose how long the price holds" })
      .int()
      .min(1, "At least 1 day")
      .max(MAX_QUOTE_VALID_DAYS, `${MAX_QUOTE_VALID_DAYS} days or fewer`),
  })
  .superRefine(checkTotal);
export type SubmitRemoteQuotationFormValues = z.input<typeof submitRemoteQuotationSchema>;
export type SubmitRemoteQuotationInput = z.output<typeof submitRemoteQuotationSchema>;

export const quotationDecisions = ["approve", "request_revision", "reject"] as const;
export const decideQuotationSchema = z
  .object({
    quotationId: quotationIdSchema,
    decision: z.enum(quotationDecisions),
    reason: optionalText(500, "Keep the reason under 500 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== "approve" && (!v.reason || v.reason.length < 5)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          v.decision === "request_revision"
            ? "Tell the technician what to change (at least 5 characters)"
            : "Tell the technician why (at least 5 characters)",
      });
    }
  });
export type DecideQuotationInput = z.output<typeof decideQuotationSchema>;

export const quotationIdOnlySchema = z.object({ quotationId: quotationIdSchema });

// ── Technician Visit offers ─────────────────────────────────────────────────

export const visitSlotSchema = z.object({
  date: z.string().refine(isRealDate, "Choose a date"),
  timeSlot: z.enum(timeSlots, { error: "Choose a time" }),
});
export type VisitSlot = z.infer<typeof visitSlotSchema>;

export const submitVisitOfferSchema = z
  .object({
    requestId,
    /** The visit / inspection fee only — never repair charges. 0 = free visit. */
    inspectionFeeLkr: wholeRupees("a visit fee (0 if free)", MAX_INSPECTION_FEE_LKR),
    proposedVisits: z
      .array(visitSlotSchema)
      .min(1, "Offer at least one visit time")
      .max(MAX_PROPOSED_VISITS, `Offer up to ${MAX_PROPOSED_VISITS} visit times`),
    message: optionalText(300, "Keep the message under 300 characters"),
  })
  .superRefine((v, ctx) => {
    const today = colomboToday();
    const last = addDays(today, MAX_VISIT_DAYS_AHEAD);
    v.proposedVisits.forEach((slot, i) => {
      if (slot.date < today || slot.date > last) {
        ctx.addIssue({
          code: "custom",
          path: ["proposedVisits", i, "date"],
          message: `Choose a date within the next ${MAX_VISIT_DAYS_AHEAD} days`,
        });
      }
    });
    const keys = v.proposedVisits.map((s) => `${s.date}:${s.timeSlot}`);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["proposedVisits"], message: "Each visit time must be different" });
    }
  });
export type SubmitVisitOfferInput = z.output<typeof submitVisitOfferSchema>;

export const selectVisitOfferSchema = z.object({
  requestId,
  technicianId: uid,
  visitIndex: z.coerce.number<string | number>().int().min(0).max(MAX_PROPOSED_VISITS - 1),
});
export type SelectVisitOfferInput = z.output<typeof selectVisitOfferSchema>;

export const requestIdOnlySchema = z.object({ requestId });

export const setAvailabilitySchema = z.object({ availability: z.enum(["online", "offline"]) });

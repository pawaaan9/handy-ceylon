import { z } from "zod";

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
/** A rejected quotation can be revised, but not endlessly. */
export const MAX_QUOTATION_VERSIONS = 3;

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
    lineItems: z
      .array(quotationLineSchema)
      .min(1, "Add at least one item")
      .max(MAX_QUOTATION_LINES, `Use ${MAX_QUOTATION_LINES} items or fewer`),
    estimatedDurationHours: z
      .union([z.literal(""), z.coerce.number<string | number>().int("Use whole hours").min(1).max(720)])
      .transform((v) => (v === "" ? null : v)),
    notes: optionalText(1000, "Keep notes under 1000 characters"),
  })
  .superRefine((v, ctx) => {
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
  });
export type SubmitQuotationFormValues = z.input<typeof submitQuotationSchema>;
export type SubmitQuotationInput = z.output<typeof submitQuotationSchema>;

export const decideQuotationSchema = z
  .object({
    quotationId: quotationIdSchema,
    decision: z.enum(["approve", "reject"]),
    reason: optionalText(500, "Keep the reason under 500 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "reject" && (!v.reason || v.reason.length < 5)) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Tell the technician why, so they can send a revised quotation",
      });
    }
  });
export type DecideQuotationInput = z.output<typeof decideQuotationSchema>;

export const setAvailabilitySchema = z.object({ availability: z.enum(["online", "offline"]) });

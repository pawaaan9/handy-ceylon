import { z } from "zod";

/** Sri Lanka's 25 administrative districts. */
export const sriLankaDistricts = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle",
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle",
  "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
] as const;
export const districtSchema = z.enum(sriLankaDistricts, { error: "Select a district" });

/** LKR stored as integer cents. Upper bound guards against typos. */
export const lkrCentsSchema = z.number().int().nonnegative().max(100_000_000_00);

export const quotationLineItemSchema = z.object({
  description: z.string().trim().min(2).max(200),
  quantity: z.number().positive().max(10_000),
  unitPriceCents: lkrCentsSchema,
});

export const submitQuotationSchema = z.object({
  requestId: z.string().min(1),
  bookingId: z.string().min(1).optional(),
  lineItems: z.array(quotationLineItemSchema).min(1).max(50),
  notes: z.string().trim().max(2000).optional(),
  estimatedDurationHours: z.number().positive().max(720).optional(),
  validForDays: z.number().int().min(1).max(30).default(7),
});
export type SubmitQuotationInput = z.infer<typeof submitQuotationSchema>;

export const submitOfferSchema = z.object({
  requestId: z.string().min(1),
  /** Inspection / call-out fee; required for quote_visit, optional for urgent. */
  inspectionFeeCents: lkrCentsSchema.optional(),
  etaMinutes: z.number().int().min(5).max(24 * 60).optional(),
  message: z.string().trim().max(500).optional(),
});

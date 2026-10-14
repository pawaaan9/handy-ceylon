import { z } from "zod";

import { bookingModeSchema } from "./types";

/** Sri Lanka's 25 administrative districts. */
export const sriLankaDistricts = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle",
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle",
  "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
] as const;
export const districtSchema = z.enum(sriLankaDistricts);

/** LKR stored as integer cents. Upper bound guards against typos. */
export const lkrCentsSchema = z.number().int().nonnegative().max(100_000_000_00);

export const addressSchema = z.object({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(60),
  district: districtSchema,
  location: z.object({
    lat: z.number().min(5.8).max(10),
    lng: z.number().min(79.5).max(82),
  }),
});

const mediaRefSchema = z.object({
  storagePath: z.string().min(1).max(500),
  contentType: z.string().regex(/^(image|video)\//),
});

/** Payload a customer submits for any booking mode; validated on the server. */
export const createServiceRequestSchema = z
  .object({
    mode: bookingModeSchema,
    categoryId: z.string().min(1).max(60),
    title: z.string().trim().min(5).max(100),
    description: z.string().trim().min(10).max(2000),
    address: addressSchema,
    preferredWindow: z
      .object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })
      .optional(),
    media: z.array(mediaRefSchema).max(10).default([]),
    measurements: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.mode !== "quote_online" || v.media.length > 0, {
    message: "Online quotes need at least one photo or video.",
    path: ["media"],
  });
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

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

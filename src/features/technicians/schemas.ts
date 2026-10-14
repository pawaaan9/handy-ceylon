import { z } from "zod";

import { fullNameSchema, sriLankaMobileSchema } from "@/features/auth/schemas";
import { districtSchema } from "@/features/bookings/schemas";
import { catalogueSlugSchema } from "@/features/catalogue/types";

export const MAX_APPLICATION_DOCUMENTS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const technicianApplicationSchema = z.object({
  fullName: fullNameSchema,
  phoneNumber: sriLankaMobileSchema,
  professionalIntroduction: z
    .string()
    .trim()
    .min(50, "Write at least 50 characters about your experience")
    .max(1000, "Keep your introduction under 1000 characters"),
  yearsOfExperience: z.coerce
    .number<string | number>({ error: "Enter your years of experience" })
    .int("Use whole years")
    .min(0, "Cannot be negative")
    .max(60, "Enter 60 or fewer"),
  serviceCategoryIds: z
    .array(catalogueSlugSchema)
    .min(1, "Choose at least one service")
    .max(8, "Choose up to 8 services"),
  skills: z
    .string()
    .trim()
    .min(2, "List at least one skill")
    .max(500)
    .transform((value) =>
      [...new Set(value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))],
    )
    .pipe(
      z
        .array(z.string().min(2, "Each skill needs at least 2 characters").max(60))
        .min(1, "List at least one skill")
        .max(20, "List up to 20 skills"),
    ),
  qualifications: z.string().trim().max(1000, "Keep this under 1000 characters").optional(),
  serviceAreas: z.array(districtSchema).min(1, "Choose at least one district").max(25),
  district: districtSchema,
  city: z.string().trim().min(2, "Enter your city or town").max(60),
  qualificationDocumentPaths: z.array(z.string().min(1).max(300)).max(MAX_APPLICATION_DOCUMENTS),
});
export type TechnicianApplicationFormValues = z.input<typeof technicianApplicationSchema>;
export type TechnicianApplicationInput = z.output<typeof technicianApplicationSchema>;

export const reviewApplicationSchema = z
  .object({
    applicantUid: z.string().min(1).max(128),
    decision: z.enum(["under_review", "approved", "rejected"]),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision !== "rejected" || (v.rejectionReason?.length ?? 0) >= 10, {
    message: "Explain the reason in at least 10 characters so the applicant can fix it",
    path: ["rejectionReason"],
  });
export type ReviewApplicationInput = z.output<typeof reviewApplicationSchema>;

import { z } from "zod";

import { fullNameSchema, sriLankaPhoneSchema } from "@/features/auth/schemas";
import { districtSchema } from "@/features/bookings/schemas";

export const MAX_ADDRESSES = 10;

/** Generous bounding box around Sri Lanka (incl. Jaffna peninsula and Dondra Head). */
export const SRI_LANKA_BOUNDS = { minLat: 5.7, maxLat: 10.1, minLng: 79.4, maxLng: 82.1 } as const;

/** Firestore auto-IDs: no slashes, so an id can never escape the user's folder. */
export const addressIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid address");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

const coordinate = z
  .string()
  .trim()
  .refine((v) => v === "" || Number.isFinite(Number(v)), "Enter a number")
  .transform((v) => (v === "" ? null : Number(v)));

export const addressInputSchema = z
  .object({
    label: z.string().trim().min(1, "Name this address, e.g. Home").max(30, "Use 30 characters or fewer"),
    recipientName: fullNameSchema,
    contactNumber: sriLankaPhoneSchema,
    houseOrBuilding: z
      .string()
      .trim()
      .min(1, "Enter the house number or building name")
      .max(80, "Use 80 characters or fewer"),
    street: z.string().trim().min(2, "Enter the street or road").max(120, "Use 120 characters or fewer"),
    city: z.string().trim().min(2, "Enter the city or town").max(60, "Use 60 characters or fewer"),
    district: districtSchema,
    postalCode: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{5}$/.test(v), "Sri Lankan postal codes have 5 digits")
      .transform((v) => v || null),
    directions: optionalText(300, "Keep directions under 300 characters"),
    latitude: coordinate,
    longitude: coordinate,
    makeDefault: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude === null) !== (v.longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: [v.latitude === null ? "latitude" : "longitude"],
        message: "Enter both latitude and longitude, or leave both empty",
      });
      return;
    }
    if (v.latitude !== null && (v.latitude < SRI_LANKA_BOUNDS.minLat || v.latitude > SRI_LANKA_BOUNDS.maxLat)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "This latitude is outside Sri Lanka" });
    }
    if (v.longitude !== null && (v.longitude < SRI_LANKA_BOUNDS.minLng || v.longitude > SRI_LANKA_BOUNDS.maxLng)) {
      ctx.addIssue({ code: "custom", path: ["longitude"], message: "This longitude is outside Sri Lanka" });
    }
  });

export type AddressFormValues = z.input<typeof addressInputSchema>;
export type AddressInput = z.output<typeof addressInputSchema>;

/** Serialisable address for pages and client components. */
export type AddressView = {
  id: string;
  label: string;
  recipientName: string;
  contactNumber: string;
  houseOrBuilding: string;
  street: string;
  city: string;
  district: AddressInput["district"];
  postalCode: string | null;
  directions: string | null;
  location: { lat: number; lng: number } | null;
  isDefault: boolean;
};

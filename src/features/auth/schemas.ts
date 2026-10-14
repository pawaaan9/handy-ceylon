import { z } from "zod";

import { selfSelectableRoleSchema } from "./roles";

/** Sri Lankan mobile numbers: 07XXXXXXXX or +947XXXXXXXX, normalised to E.164. */
export const sriLankaMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(?:\+94|0)7\d{8}$/, "Enter a valid Sri Lankan mobile number"))
  .transform((value) => (value.startsWith("0") ? `+94${value.slice(1)}` : value));

export const onboardingInputSchema = z.object({
  role: selfSelectableRoleSchema,
  displayName: z.string().trim().min(2).max(80),
  phone: sriLankaMobileSchema,
});
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

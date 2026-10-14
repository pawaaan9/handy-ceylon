import { z } from "zod";

import { fullNameSchema, sriLankaMobileSchema } from "@/features/auth/schemas";

/**
 * Editable account fields only. Role, account status, email and verification
 * state are deliberately absent — anything else submitted is stripped.
 * Service addresses are managed separately (features/addresses).
 */
export const customerProfileSchema = z.object({
  fullName: fullNameSchema,
  phoneNumber: sriLankaMobileSchema,
});
export type CustomerProfileFormValues = z.input<typeof customerProfileSchema>;
export type CustomerProfileInput = z.output<typeof customerProfileSchema>;

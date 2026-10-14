import { z } from "zod";

export const userRoles = ["customer", "technician", "admin"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * Roles a person may choose for themselves during onboarding.
 * `admin` is deliberately excluded: it is granted only by an existing
 * administrator through the Admin SDK (see scripts/grant-admin.mjs).
 */
export const selfSelectableRoles = ["customer", "technician"] as const;
export const selfSelectableRoleSchema = z.enum(selfSelectableRoles);
export type SelfSelectableRole = z.infer<typeof selfSelectableRoleSchema>;

/**
 * Custom claims on the Firebase ID token. Only the Admin SDK can set these,
 * so Security Rules and server code can trust them.
 */
export const authClaimsSchema = z.object({
  role: userRoleSchema.optional(),
  /** Set by an administrator once a technician passes verification. */
  technicianVerified: z.boolean().optional(),
});
export type AuthClaims = z.infer<typeof authClaimsSchema>;

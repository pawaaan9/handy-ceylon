import { z } from "zod";

export const userRoles = ["customer", "technician", "admin"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

export const accountStatuses = ["active", "suspended"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

/**
 * Custom claims on the Firebase ID token, used by Security Rules.
 * Only the Admin SDK can set them. Server code reads the authoritative role
 * from users/{uid} instead, so a stale token can never grant access.
 */
export const authClaimsSchema = z.object({
  role: userRoleSchema.optional(),
});
export type AuthClaims = z.infer<typeof authClaimsSchema>;

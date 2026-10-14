import "server-only";

import { adminAuth } from "@/lib/firebase/admin";

import { authClaimsSchema, type UserRole } from "../roles";
import { AuthError } from "./errors";

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  role: UserRole | null;
  technicianVerified: boolean;
};

/**
 * Verifies a Firebase ID token sent as `Authorization: Bearer <token>` and
 * returns the caller's identity. Roles come from verified custom claims —
 * never from the request body or client state.
 */
export async function getUserFromRequest(
  request: Request,
): Promise<AuthenticatedUser> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new AuthError("Missing bearer token.", 401);

  let decoded;
  try {
    // checkRevoked: suspended users lose access immediately.
    decoded = await adminAuth().verifyIdToken(match[1], true);
  } catch {
    throw new AuthError("Invalid or expired session.", 401);
  }

  const claims = authClaimsSchema.safeParse(decoded);
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    role: claims.success ? (claims.data.role ?? null) : null,
    technicianVerified: claims.success
      ? claims.data.technicianVerified === true
      : false,
  };
}

export function requireRole(
  user: AuthenticatedUser,
  allowed: readonly UserRole[],
): asserts user is AuthenticatedUser & { role: UserRole } {
  if (!user.role || !allowed.includes(user.role)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
}

import "server-only";

import { adminAuth } from "@/lib/firebase/admin";

import type { UserRole } from "../roles";

/**
 * Mirrors the authoritative Firestore role into custom claims so Security
 * Rules can use it. Existing claims are preserved. Clients pick the change up
 * on their next token refresh (forced via getIdToken(true) after sign-in).
 */
export async function setRoleClaim(uid: string, role: UserRole): Promise<void> {
  const auth = adminAuth();
  const { customClaims } = await auth.getUser(uid);
  if (customClaims?.role === role) return;
  await auth.setCustomUserClaims(uid, { ...customClaims, role });
}

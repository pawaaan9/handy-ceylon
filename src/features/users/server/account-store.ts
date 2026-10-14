import "server-only";

import type { UserRole } from "@/features/auth/roles";
import { adminDb } from "@/lib/firebase/admin";
import { roleCollections } from "@/lib/firestore/collections";
import type { AccountBase } from "@/lib/firestore/models";

/**
 * Roles live in separate collections. When a uid has documents in more than
 * one (an approved technician keeps their customer record), the most
 * privileged one wins.
 */
const precedence: readonly UserRole[] = ["admin", "technician", "customer"];

export type ResolvedAccount = { role: UserRole; data: AccountBase };

export const accountRef = (role: UserRole, uid: string) =>
  adminDb().collection(roleCollections[role]).doc(uid);

/** One round trip (getAll) to find which role collection holds this uid. */
export async function resolveAccount(uid: string): Promise<ResolvedAccount | null> {
  const snaps = await adminDb().getAll(...precedence.map((role) => accountRef(role, uid)));
  const index = snaps.findIndex((s) => s.exists);
  if (index === -1) return null;
  return { role: precedence[index], data: snaps[index].data() as AccountBase };
}

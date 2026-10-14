import "server-only";

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";

import { collections } from "@/lib/firestore/collections";
import { UserFacingError } from "@/lib/errors";

export const PHONE_TAKEN_MESSAGE =
  "This mobile number is already linked to another Handy Ceylon account.";

/** Cheap pre-check outside a transaction, used before creating Auth users. */
export async function isPhoneNumberTaken(db: Firestore, phoneNumber: string, uid?: string) {
  const snap = await db.collection(collections.phoneIndex).doc(phoneNumber).get();
  return snap.exists && snap.get("uid") !== uid;
}

/**
 * Transaction-safe phone reassignment. Firestore transactions require all
 * reads before writes, so this reads now and returns the write step.
 */
export async function preparePhoneChange(
  db: Firestore,
  tx: Transaction,
  uid: string,
  currentPhone: string | null,
  nextPhone: string,
): Promise<() => void> {
  if (currentPhone === nextPhone) return () => {};

  const nextRef = db.collection(collections.phoneIndex).doc(nextPhone);
  const nextSnap = await tx.get(nextRef);
  if (nextSnap.exists && nextSnap.get("uid") !== uid) {
    throw new UserFacingError(PHONE_TAKEN_MESSAGE, "phoneNumber");
  }

  return () => {
    tx.set(nextRef, { uid, createdAt: FieldValue.serverTimestamp() });
    if (currentPhone) tx.delete(db.collection(collections.phoneIndex).doc(currentPhone));
  };
}

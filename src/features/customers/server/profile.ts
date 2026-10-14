import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { preparePhoneChange } from "@/features/users/server/phone-index";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import { UserFacingError } from "@/lib/errors";

import type { CustomerProfileInput } from "../schemas";

/**
 * Updates only whitelisted account fields. The uid comes from the verified
 * session; role, account status and email cannot be changed through this path.
 */
export async function updateCustomerProfile(uid: string, input: CustomerProfileInput): Promise<void> {
  const db = adminDb();
  const userRef = db.collection(collections.customers).doc(uid);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new UserFacingError("Your profile could not be found. Please log in again.");
    }
    const applyPhone = await preparePhoneChange(
      db,
      tx,
      uid,
      userSnap.get("phoneNumber") ?? null,
      input.phoneNumber,
    );
    tx.update(userRef, {
      displayName: input.fullName,
      phoneNumber: input.phoneNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });
    applyPhone();
  });

  await adminAuth().updateUser(uid, { displayName: input.fullName });
}

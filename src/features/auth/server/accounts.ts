import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import {
  isPhoneNumberTaken,
  PHONE_TAKEN_MESSAGE,
  preparePhoneChange,
} from "@/features/users/server/phone-index";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import { UserFacingError } from "@/lib/errors";

import type { SignUpInput } from "../schemas";
import { setRoleClaim } from "./claims";

type CustomerDetails = {
  fullName: string;
  email: string;
  phoneNumber: string;
};

/**
 * Creates users/{uid}, customerProfiles/{uid} and the phone index atomically,
 * then sets the `customer` claim. Public registration can only ever produce a
 * customer — there is no input that selects another role.
 */
export async function provisionCustomer(uid: string, details: CustomerDetails): Promise<void> {
  const db = adminDb();
  const userRef = db.collection(collections.users).doc(uid);
  const profileRef = db.collection(collections.customerProfiles).doc(uid);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) throw new UserFacingError("This account is already set up.");
    const applyPhone = await preparePhoneChange(db, tx, uid, null, details.phoneNumber);

    const now = FieldValue.serverTimestamp();
    tx.create(userRef, {
      uid,
      role: "customer",
      accountStatus: "active",
      displayName: details.fullName,
      email: details.email,
      phoneNumber: details.phoneNumber,
      photoURL: null,
      photoPath: null,
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(profileRef, {
      uid,
      defaultAddressId: null,
      createdAt: now,
      updatedAt: now,
    });
    applyPhone();
  });

  await setRoleClaim(uid, "customer");
}

/** Removes everything provisionCustomer may have written. Used for rollback. */
async function deprovision(uid: string, phoneNumber: string): Promise<void> {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const phoneRef = db.collection(collections.phoneIndex).doc(phoneNumber);
    const phone = await tx.get(phoneRef);
    if (phone.exists && phone.get("uid") === uid) tx.delete(phoneRef);
    tx.delete(db.collection(collections.users).doc(uid));
    tx.delete(db.collection(collections.customerProfiles).doc(uid));
  });
}

/**
 * Public customer sign-up. Order matters for consistency:
 *   1. reject a taken phone number before touching Auth
 *   2. create the Auth user (Firebase enforces unique email)
 *   3. provision Firestore + claims
 * If step 3 fails, steps 2–3 are rolled back so no half-created account remains.
 * Passwords go straight to Firebase Auth and are never stored by us.
 */
export async function createCustomerAccount(input: SignUpInput): Promise<{ uid: string }> {
  const db = adminDb();
  if (await isPhoneNumberTaken(db, input.phoneNumber)) {
    throw new UserFacingError(PHONE_TAKEN_MESSAGE, "phoneNumber");
  }

  let uid: string;
  try {
    const record = await adminAuth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.fullName,
      emailVerified: false,
      disabled: false,
    });
    uid = record.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      throw new UserFacingError(
        "An account with this email already exists. Log in or reset your password.",
        "email",
      );
    }
    if (code === "auth/invalid-password") {
      throw new UserFacingError("Choose a stronger password.", "password");
    }
    if (code === "auth/invalid-email") {
      throw new UserFacingError("Enter a valid email address.", "email");
    }
    throw error;
  }

  try {
    await provisionCustomer(uid, input);
  } catch (error) {
    await deprovision(uid, input.phoneNumber).catch((e) =>
      console.error("[signup] rollback of Firestore records failed", uid, e),
    );
    await adminAuth()
      .deleteUser(uid)
      .catch((e) => console.error("[signup] rollback of Auth user failed", uid, e));
    throw error;
  }

  return { uid };
}

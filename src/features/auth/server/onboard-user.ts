import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";

import type { OnboardingInput } from "../schemas";
import { AuthError } from "./errors";
import type { AuthenticatedUser } from "./current-user";

/**
 * Creates the user's account records and assigns their role exactly once.
 * The role is written by the server (custom claim + users/{uid}.role); the
 * client can never set or change it afterwards.
 */
export async function onboardUser(
  user: AuthenticatedUser,
  input: OnboardingInput,
): Promise<void> {
  if (user.role) throw new AuthError("Account is already set up.", 409);

  const db = adminDb();
  const userRef = db.collection(collections.users).doc(user.uid);
  const profileRef = db
    .collection(
      input.role === "technician"
        ? collections.technicianProfiles
        : collections.customerProfiles,
    )
    .doc(user.uid);

  const assignedRole = await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    // A previous attempt wrote the records but failed before setting claims:
    // re-apply the stored role rather than letting the caller choose again.
    if (existing.exists) return existing.get("role") as OnboardingInput["role"];

    const now = FieldValue.serverTimestamp();
    tx.create(userRef, {
      uid: user.uid,
      role: input.role,
      displayName: input.displayName,
      email: user.email,
      phone: input.phone,
      photoURL: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    if (input.role === "technician") {
      tx.create(profileRef, {
        uid: user.uid,
        displayName: input.displayName,
        bio: "",
        categoryIds: [],
        serviceDistricts: [],
        availability: "offline",
        verificationStatus: "pending",
        ratingAverage: 0,
        ratingCount: 0,
        completedJobs: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      tx.create(profileRef, {
        uid: user.uid,
        savedAddresses: [],
        defaultAddressId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return input.role;
  });

  // Technicians start unverified; an admin sets technicianVerified after review.
  await adminAuth().setCustomUserClaims(user.uid, {
    role: assignedRole,
    technicianVerified: false,
  });
}

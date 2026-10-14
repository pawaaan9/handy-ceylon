import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type { TechnicianProfileDoc } from "@/lib/firestore/models";

export async function getTechnicianProfile(
  uid: string,
): Promise<Pick<TechnicianProfileDoc, "categoryIds" | "serviceDistricts" | "verificationStatus"> | null> {
  const snap = await adminDb().collection(collections.technicianProfiles).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as TechnicianProfileDoc;
  return {
    categoryIds: data.categoryIds,
    serviceDistricts: data.serviceDistricts,
    verificationStatus: data.verificationStatus,
  };
}

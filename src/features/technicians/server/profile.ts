import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type { TechnicianDoc } from "@/lib/firestore/models";

export async function getTechnicianProfile(
  uid: string,
): Promise<Pick<
  TechnicianDoc,
  | "categoryIds"
  | "serviceDistricts"
  | "verificationStatus"
  | "availability"
  | "completedJobs"
  | "ratingAverage"
  | "ratingCount"
> | null> {
  const snap = await adminDb().collection(collections.technicians).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as TechnicianDoc;
  return {
    categoryIds: data.categoryIds,
    serviceDistricts: data.serviceDistricts,
    verificationStatus: data.verificationStatus,
    availability: data.availability ?? "offline",
    completedJobs: data.completedJobs ?? 0,
    ratingAverage: data.ratingAverage ?? 0,
    ratingCount: data.ratingCount ?? 0,
  };
}

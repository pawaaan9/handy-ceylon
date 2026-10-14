import "server-only";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { setRoleClaim } from "@/features/auth/server/claims";
import { assertActiveCategoryIds } from "@/features/catalogue/server/repository";
import type { CurrentUser } from "@/features/auth/server/dal";
import { isOwnedPath } from "@/features/users/server/profile-photo";
import { preparePhoneChange } from "@/features/users/server/phone-index";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { collections, storagePaths } from "@/lib/firestore/collections";
import type { CustomerDoc, TechnicianApplicationDoc, TechnicianDoc } from "@/lib/firestore/models";
import { AuthError, UserFacingError } from "@/lib/errors";
import { assertTransition } from "@/lib/state-machine";

import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type ReviewApplicationInput,
  type TechnicianApplicationInput,
} from "../schemas";
import { applicationTransitions, type TechnicianApplicationStatus } from "../types";

/** Serialisable view for pages (Timestamps → ISO strings). */
export type TechnicianApplicationView = Omit<
  TechnicianApplicationDoc,
  "submittedAt" | "reviewedAt" | "updatedAt"
> & { submittedAt: string; reviewedAt: string | null; updatedAt: string };

function toView(data: TechnicianApplicationDoc): TechnicianApplicationView {
  const iso = (t: Timestamp | null | undefined) => (t ? t.toDate().toISOString() : null);
  return {
    ...data,
    submittedAt: iso(data.submittedAt as unknown as Timestamp) ?? new Date(0).toISOString(),
    reviewedAt: iso(data.reviewedAt as unknown as Timestamp | null),
    updatedAt: iso(data.updatedAt as unknown as Timestamp) ?? new Date(0).toISOString(),
  };
}

const applicationsRef = () => adminDb().collection(collections.technicianApplications);

export async function getApplication(uid: string): Promise<TechnicianApplicationView | null> {
  const snap = await applicationsRef().doc(uid).get();
  return snap.exists ? toView(snap.data() as TechnicianApplicationDoc) : null;
}

/** Each document must be the applicant's own upload, of an allowed type and size. */
async function verifyDocuments(uid: string, paths: string[]): Promise<string[]> {
  const unique = [...new Set(paths)];
  const prefix = storagePaths.technicianDocumentPrefix(uid);
  const bucket = adminStorage().bucket();
  for (const path of unique) {
    if (!isOwnedPath(path, prefix)) {
      throw new UserFacingError("One of your documents can't be used. Please upload it again.");
    }
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) throw new UserFacingError("A document upload is missing. Please upload it again.");
    const [metadata] = await file.getMetadata();
    if (
      !ALLOWED_DOCUMENT_TYPES.includes(metadata.contentType as (typeof ALLOWED_DOCUMENT_TYPES)[number]) ||
      Number(metadata.size ?? 0) > MAX_DOCUMENT_BYTES
    ) {
      throw new UserFacingError("Documents must be PDF, JPG, PNG or WebP files under 10 MB.");
    }
  }
  return unique;
}

/**
 * Creates (or resubmits after rejection) the caller's application. It never
 * grants any privilege: the applicant stays a customer until an admin approves.
 */
export async function submitApplication(
  user: CurrentUser,
  input: TechnicianApplicationInput,
): Promise<void> {
  if (user.role !== "customer") {
    throw new AuthError(
      user.role === "technician"
        ? "Your technician account is already active."
        : "This account type can't apply as a technician.",
      403,
    );
  }
  // Authoritative check — never a client-supplied flag.
  const record = await adminAuth().getUser(user.uid);
  if (!record.email || !record.emailVerified) {
    throw new UserFacingError("Add and verify an email address before applying.");
  }
  const verifiedEmail = record.email.toLowerCase();

  // Only categories that are active in Firestore right now can be offered.
  await assertActiveCategoryIds(input.serviceCategoryIds);
  const documentPaths = await verifyDocuments(user.uid, input.qualificationDocumentPaths);
  const db = adminDb();
  const userRef = db.collection(collections.customers).doc(user.uid);
  const appRef = applicationsRef().doc(user.uid);

  await db.runTransaction(async (tx) => {
    const [userSnap, appSnap] = await Promise.all([tx.get(userRef), tx.get(appRef)]);
    if (!userSnap.exists) throw new AuthError("Your profile could not be found.", 403);
    const photoURL = userSnap.get("photoURL") as string | null;
    if (!photoURL) throw new UserFacingError("Add a profile photo before applying.", "photo");

    let submissionCount = 1;
    if (appSnap.exists) {
      const current = appSnap.get("applicationStatus") as TechnicianApplicationStatus;
      if (current !== "rejected") {
        throw new UserFacingError("You already have an application in progress.");
      }
      assertTransition(applicationTransitions, current, "pending", "applicant");
      submissionCount = (appSnap.get("submissionCount") ?? 1) + 1;
    }

    const applyPhone = await preparePhoneChange(
      db,
      tx,
      user.uid,
      userSnap.get("phoneNumber") ?? null,
      input.phoneNumber,
    );

    const now = FieldValue.serverTimestamp();
    tx.set(appRef, {
      uid: user.uid,
      displayName: input.fullName,
      email: verifiedEmail,
      phoneNumber: input.phoneNumber,
      photoURL,
      professionalIntroduction: input.professionalIntroduction,
      yearsOfExperience: input.yearsOfExperience,
      serviceCategoryIds: input.serviceCategoryIds,
      skills: input.skills,
      qualifications: input.qualifications || null,
      serviceAreas: input.serviceAreas,
      district: input.district,
      city: input.city,
      qualificationDocumentPaths: documentPaths,
      applicationStatus: "pending",
      submissionCount,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      updatedAt: now,
    } satisfies Record<keyof TechnicianApplicationDoc, unknown>);
    tx.update(userRef, { displayName: input.fullName, phoneNumber: input.phoneNumber, updatedAt: now });
    applyPhone();
  });
}

/**
 * Admin decision. Approval atomically promotes the user to `technician` and
 * creates their technician profile; the custom claim follows immediately after.
 */
export async function reviewApplication(
  reviewer: CurrentUser,
  input: ReviewApplicationInput,
): Promise<void> {
  if (reviewer.role !== "admin") throw new AuthError("Only administrators can review applications.", 403);
  if (reviewer.uid === input.applicantUid) {
    throw new AuthError("You can't review your own application.", 403);
  }

  const db = adminDb();
  const appRef = applicationsRef().doc(input.applicantUid);
  const customerRef = db.collection(collections.customers).doc(input.applicantUid);
  const techRef = db.collection(collections.technicians).doc(input.applicantUid);
  const adminRef = db.collection(collections.admins).doc(input.applicantUid);

  await db.runTransaction(async (tx) => {
    const [appSnap, customerSnap, techSnap, adminSnap] = await tx.getAll(appRef, customerRef, techRef, adminRef);
    if (!appSnap.exists) throw new UserFacingError("Application not found.");
    const app = appSnap.data() as TechnicianApplicationDoc;
    assertTransition(applicationTransitions, app.applicationStatus, input.decision, "admin");

    const now = FieldValue.serverTimestamp();
    tx.update(appRef, {
      applicationStatus: input.decision,
      reviewedAt: now,
      reviewedBy: reviewer.uid,
      rejectionReason: input.decision === "rejected" ? input.rejectionReason ?? null : null,
      updatedAt: now,
    });

    if (input.decision !== "approved") return;

    if (!customerSnap.exists || customerSnap.get("accountStatus") !== "active") {
      throw new UserFacingError("The applicant's customer account is not active.");
    }
    if (techSnap.exists || adminSnap.exists) {
      throw new UserFacingError("Only customer accounts can be promoted to technician.");
    }
    const customer = customerSnap.data() as CustomerDoc;
    // The technician account lives in its own collection; the customer record
    // (addresses, history) is kept but no longer decides the role.
    tx.create(techRef, {
      uid: input.applicantUid,
      accountStatus: "active",
      displayName: app.displayName,
      email: customer.email,
      phoneNumber: app.phoneNumber,
      photoURL: customer.photoURL ?? app.photoURL,
      photoPath: customer.photoPath ?? null,
      bio: app.professionalIntroduction,
      categoryIds: app.serviceCategoryIds,
      serviceDistricts: app.serviceAreas,
      skills: app.skills,
      yearsOfExperience: app.yearsOfExperience,
      district: app.district,
      city: app.city,
      availability: "offline",
      verificationStatus: "approved",
      ratingAverage: 0,
      ratingCount: 0,
      completedJobs: 0,
      approvedAt: now,
      approvedBy: reviewer.uid,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof Omit<TechnicianDoc, "baseLocation">, unknown>);
  });

  if (input.decision === "approved") {
    // Firestore is already authoritative for server checks; the claim lets
    // Security Rules recognise the technician once their token refreshes.
    await setRoleClaim(input.applicantUid, "technician");
  }
}

export async function listApplications(
  status: TechnicianApplicationStatus,
  limit = 50,
): Promise<TechnicianApplicationView[]> {
  const snap = await applicationsRef()
    .where("applicationStatus", "==", status)
    .orderBy("submittedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => toView(d.data() as TechnicianApplicationDoc));
}

export async function countApplicationsByStatus(): Promise<Record<TechnicianApplicationStatus, number>> {
  const statuses: TechnicianApplicationStatus[] = ["pending", "under_review", "approved", "rejected"];
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const agg = await applicationsRef().where("applicationStatus", "==", status).count().get();
      return [status, agg.data().count] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<TechnicianApplicationStatus, number>;
}

/** Short-lived links so admins can open private documents. */
export async function getDocumentLinks(
  paths: string[],
): Promise<{ path: string; name: string; url: string | null }[]> {
  const bucket = adminStorage().bucket();
  return Promise.all(
    paths.map(async (path) => {
      const name = path.split("/").pop()?.replace(/^\d+-/, "") ?? path;
      try {
        const [url] = await bucket.file(path).getSignedUrl({
          action: "read",
          expires: Date.now() + 10 * 60 * 1000,
        });
        return { path, name, url };
      } catch {
        return { path, name, url: null };
      }
    }),
  );
}

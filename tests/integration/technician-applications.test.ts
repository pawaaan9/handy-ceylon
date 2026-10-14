import { beforeEach, describe, expect, it } from "vitest";

import { signUpSchema } from "@/features/auth/schemas";
import { createCustomerAccount } from "@/features/auth/server/accounts";
import type { CurrentUser } from "@/features/auth/server/dal";
import { technicianApplicationSchema } from "@/features/technicians/schemas";
import { reviewApplication, submitApplication } from "@/features/technicians/server/applications";
import { setProfilePhoto } from "@/features/users/server/profile-photo";
import { AuthError, UserFacingError } from "@/lib/errors";
import { TransitionError } from "@/lib/state-machine";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

import { resetEmulators, seedCategory, uploadAs, validSignUp } from "./helpers";

beforeEach(async () => {
  await resetEmulators();
  await seedCategory("plumbing");
  await seedCategory("retired-trade", { active: false });
});

const applicationInput = (overrides: Record<string, unknown> = {}) =>
  technicianApplicationSchema.parse({
    fullName: "Nimal Perera",
    phoneNumber: "0771234567",
    professionalIntroduction:
      "Licensed plumber with experience in residential pipe fitting, leak repairs and water pump installation.",
    yearsOfExperience: "8",
    serviceCategoryIds: ["plumbing"],
    skills: "PPR fitting, pump installation",
    qualifications: "NVQ Level 4 Plumbing",
    serviceAreas: ["Colombo", "Gampaha"],
    district: "Colombo",
    city: "Nugegoda",
    qualificationDocumentPaths: [],
    ...overrides,
  });

function asUser(uid: string, role: CurrentUser["role"]): CurrentUser {
  return {
    uid,
    role,
    email: `${uid}@example.com`,
    emailVerified: true,
    accountStatus: "active",
    displayName: uid,
    phoneNumber: null,
    photoURL: null,
  };
}

async function readyApplicant() {
  const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
  await adminAuth().updateUser(uid, { emailVerified: true });
  await uploadAs(`users/${uid}/avatar/me.png`, "image/png");
  await setProfilePhoto(uid, `users/${uid}/avatar/me.png`);
  return uid;
}

async function createAdmin() {
  const admin = await adminAuth().createUser({ email: "admin@example.com", password: "Admin1Password" });
  await adminDb().doc(`users/${admin.uid}`).set({ uid: admin.uid, role: "admin", accountStatus: "active" });
  await adminAuth().setCustomUserClaims(admin.uid, { role: "admin" });
  return asUser(admin.uid, "admin");
}

describe("submitting an application", () => {
  it("requires a verified email (checked against Firebase Auth)", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    // A client claiming to be verified changes nothing.
    await expect(
      submitApplication({ ...asUser(uid, "customer"), emailVerified: true }, applicationInput()),
    ).rejects.toThrow("Verify your email");
  });

  it("requires a profile photo", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    await adminAuth().updateUser(uid, { emailVerified: true });
    await expect(submitApplication(asUser(uid, "customer"), applicationInput())).rejects.toMatchObject({
      field: "photo",
    });
  });

  it("creates a pending application without granting any privilege", async () => {
    const uid = await readyApplicant();
    await submitApplication(asUser(uid, "customer"), applicationInput());

    const app = (await adminDb().doc(`technicianApplications/${uid}`).get()).data();
    expect(app).toMatchObject({ applicationStatus: "pending", reviewedBy: null, skills: ["PPR fitting", "pump installation"] });
    expect((await adminDb().doc(`users/${uid}`).get()).get("role")).toBe("customer");
    expect((await adminAuth().getUser(uid)).customClaims?.role).toBe("customer");
    expect((await adminDb().doc(`technicianProfiles/${uid}`).get()).exists).toBe(false);
  });

  it("blocks a second application while one is in progress", async () => {
    const uid = await readyApplicant();
    await submitApplication(asUser(uid, "customer"), applicationInput());
    await expect(submitApplication(asUser(uid, "customer"), applicationInput())).rejects.toBeInstanceOf(
      UserFacingError,
    );
  });

  it("accepts only the applicant's own document uploads", async () => {
    const uid = await readyApplicant();
    await uploadAs("technicianDocuments/someone-else/cert.pdf", "application/pdf");
    await expect(
      submitApplication(
        asUser(uid, "customer"),
        applicationInput({ qualificationDocumentPaths: ["technicianDocuments/someone-else/cert.pdf"] }),
      ),
    ).rejects.toThrow("can't be used");

    await uploadAs(`technicianDocuments/${uid}/cert.pdf`, "application/pdf");
    await submitApplication(
      asUser(uid, "customer"),
      applicationInput({ qualificationDocumentPaths: [`technicianDocuments/${uid}/cert.pdf`] }),
    );
  });

  it("only accepts categories that are active in Firestore", async () => {
    const uid = await readyApplicant();
    await expect(
      submitApplication(asUser(uid, "customer"), applicationInput({ serviceCategoryIds: ["retired-trade"] })),
    ).rejects.toMatchObject({ field: "serviceCategoryIds" });
    await expect(
      submitApplication(asUser(uid, "customer"), applicationInput({ serviceCategoryIds: ["does-not-exist"] })),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("is refused for admins and existing technicians", async () => {
    await expect(submitApplication(asUser("x", "admin"), applicationInput())).rejects.toBeInstanceOf(AuthError);
    await expect(submitApplication(asUser("y", "technician"), applicationInput())).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});

describe("reviewing applications", () => {
  it("only administrators can review", async () => {
    const uid = await readyApplicant();
    await submitApplication(asUser(uid, "customer"), applicationInput());
    for (const role of ["customer", "technician"] as const) {
      await expect(
        reviewApplication(asUser("not-admin", role), { applicantUid: uid, decision: "approved" }),
      ).rejects.toBeInstanceOf(AuthError);
    }
    expect((await adminDb().doc(`users/${uid}`).get()).get("role")).toBe("customer");
  });

  it("approval promotes the user, creates the technician profile and sets the claim", async () => {
    const uid = await readyApplicant();
    await submitApplication(asUser(uid, "customer"), applicationInput());
    const admin = await createAdmin();

    await reviewApplication(admin, { applicantUid: uid, decision: "under_review" });
    await reviewApplication(admin, { applicantUid: uid, decision: "approved" });

    const app = (await adminDb().doc(`technicianApplications/${uid}`).get()).data();
    expect(app).toMatchObject({ applicationStatus: "approved", reviewedBy: admin.uid });
    expect((await adminDb().doc(`users/${uid}`).get()).get("role")).toBe("technician");
    expect((await adminDb().doc(`technicianProfiles/${uid}`).get()).data()).toMatchObject({
      verificationStatus: "approved",
      categoryIds: ["plumbing"],
    });
    expect((await adminAuth().getUser(uid)).customClaims?.role).toBe("technician");

    await expect(
      reviewApplication(admin, { applicantUid: uid, decision: "rejected", rejectionReason: "Too late now." }),
    ).rejects.toBeInstanceOf(TransitionError);
  });

  it("rejection keeps the customer role and allows resubmission", async () => {
    const uid = await readyApplicant();
    await submitApplication(asUser(uid, "customer"), applicationInput());
    const admin = await createAdmin();
    await reviewApplication(admin, {
      applicantUid: uid,
      decision: "rejected",
      rejectionReason: "Please attach your NVQ certificate.",
    });

    expect((await adminDb().doc(`users/${uid}`).get()).get("role")).toBe("customer");
    await submitApplication(asUser(uid, "customer"), applicationInput());
    const app = (await adminDb().doc(`technicianApplications/${uid}`).get()).data();
    expect(app).toMatchObject({ applicationStatus: "pending", submissionCount: 2, rejectionReason: null });
  });
});

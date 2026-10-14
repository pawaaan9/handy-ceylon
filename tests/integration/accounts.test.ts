import { beforeEach, describe, expect, it } from "vitest";

import { createCustomerAccount } from "@/features/auth/server/accounts";
import { signUpSchema } from "@/features/auth/schemas";
import { UserFacingError } from "@/lib/errors";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

import { resetEmulators, validSignUp } from "./helpers";

beforeEach(resetEmulators);

const signUp = (overrides = {}) => createCustomerAccount(signUpSchema.parse(validSignUp(overrides)));

describe("customer sign-up", () => {
  it("creates the Auth user, Firestore records and customer claim together", async () => {
    const { uid } = await signUp();

    const user = await adminAuth().getUser(uid);
    expect(user.customClaims).toEqual({ role: "customer" });
    expect(user.emailVerified).toBe(false);

    const doc = (await adminDb().doc(`users/${uid}`).get()).data();
    expect(doc).toMatchObject({ role: "customer", accountStatus: "active", phoneNumber: "+94771234567" });
    expect(doc).not.toHaveProperty("password");
    expect((await adminDb().doc(`customerProfiles/${uid}`).get()).exists).toBe(true);
    expect((await adminDb().doc("phoneIndex/+94771234567").get()).get("uid")).toBe(uid);
  });

  it("can never create anything but a customer, even if a role is submitted", async () => {
    const { uid } = await createCustomerAccount(
      signUpSchema.parse({ ...validSignUp(), role: "admin", accountStatus: "active" }),
    );
    expect((await adminDb().doc(`users/${uid}`).get()).get("role")).toBe("customer");
    expect((await adminAuth().getUser(uid)).customClaims?.role).toBe("customer");
  });

  it("rejects a duplicate email", async () => {
    await signUp();
    await expect(signUp({ phoneNumber: "+94770000000" })).rejects.toMatchObject({
      field: "email",
    });
  });

  it("rejects a duplicate mobile number without creating an Auth user", async () => {
    await signUp();
    await expect(signUp({ email: "other@example.com" })).rejects.toBeInstanceOf(UserFacingError);
    const { users } = await adminAuth().listUsers();
    expect(users.map((u) => u.email)).toEqual(["nimal@example.com"]);
  });
});

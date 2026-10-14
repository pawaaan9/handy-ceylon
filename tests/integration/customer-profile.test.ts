import { beforeEach, describe, expect, it } from "vitest";

import { signUpSchema } from "@/features/auth/schemas";
import { createCustomerAccount } from "@/features/auth/server/accounts";
import { customerProfileSchema } from "@/features/customers/schemas";
import { updateCustomerProfile } from "@/features/customers/server/profile";
import { setProfilePhoto } from "@/features/users/server/profile-photo";
import { adminDb } from "@/lib/firebase/admin";

import { resetEmulators, uploadAs, validSignUp } from "./helpers";

beforeEach(resetEmulators);

const profileInput = (overrides: Record<string, unknown> = {}) =>
  customerProfileSchema.parse({ fullName: "Nimal Perera", phoneNumber: "0771234567", ...overrides });

describe("customer profile", () => {
  it("updates name and mobile number", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    await updateCustomerProfile(uid, profileInput({ fullName: "Nimal K. Perera" }));
    expect((await adminDb().doc(`users/${uid}`).get()).get("displayName")).toBe("Nimal K. Perera");
  });

  it("ignores protected fields such as role and account status", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    const input = customerProfileSchema.parse({
      ...profileInput(),
      role: "admin",
      accountStatus: "active",
      email: "attacker@example.com",
    });
    await updateCustomerProfile(uid, input);
    const user = (await adminDb().doc(`users/${uid}`).get()).data();
    expect(user).toMatchObject({ role: "customer", email: "nimal@example.com" });
  });

  it("moves the phone index when the number changes and blocks taken numbers", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    await createCustomerAccount(
      signUpSchema.parse(validSignUp({ email: "other@example.com", phoneNumber: "0779999999" })),
    );

    await updateCustomerProfile(uid, profileInput({ phoneNumber: "0775555555" }));
    expect((await adminDb().doc("phoneIndex/+94771234567").get()).exists).toBe(false);
    expect((await adminDb().doc("phoneIndex/+94775555555").get()).get("uid")).toBe(uid);

    await expect(updateCustomerProfile(uid, profileInput({ phoneNumber: "0779999999" }))).rejects.toMatchObject({
      field: "phoneNumber",
    });
  });

  it("only accepts profile photos from the user's own folder", async () => {
    const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
    await uploadAs("users/someone-else/avatar/me.png", "image/png");
    await expect(setProfilePhoto(uid, "users/someone-else/avatar/me.png")).rejects.toThrow("can't be used");
    await expect(setProfilePhoto(uid, `users/${uid}/avatar/../../x.png`)).rejects.toThrow("can't be used");

    await uploadAs(`users/${uid}/avatar/doc.pdf`, "application/pdf");
    await expect(setProfilePhoto(uid, `users/${uid}/avatar/doc.pdf`)).rejects.toThrow("JPG, PNG or WebP");

    await uploadAs(`users/${uid}/avatar/me.png`, "image/png");
    const url = await setProfilePhoto(uid, `users/${uid}/avatar/me.png`);
    expect((await adminDb().doc(`users/${uid}`).get()).get("photoURL")).toBe(url);
  });
});

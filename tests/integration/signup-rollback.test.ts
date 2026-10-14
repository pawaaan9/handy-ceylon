import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCustomerAccount } from "@/features/auth/server/accounts";
import { signUpSchema } from "@/features/auth/schemas";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

import { resetEmulators, validSignUp } from "./helpers";

// Simulate a failure after the Auth user and Firestore records were written.
vi.mock("@/features/auth/server/claims", () => ({
  setRoleClaim: vi.fn().mockRejectedValue(new Error("claims service unavailable")),
}));

beforeEach(resetEmulators);

describe("sign-up rollback", () => {
  it("leaves no Auth user or Firestore records behind when a later step fails", async () => {
    await expect(createCustomerAccount(signUpSchema.parse(validSignUp()))).rejects.toThrow(
      "claims service unavailable",
    );
    expect((await adminAuth().listUsers()).users).toHaveLength(0);
    expect((await adminDb().collection("users").get()).size).toBe(0);
    expect((await adminDb().collection("customerProfiles").get()).size).toBe(0);
    expect((await adminDb().collection("phoneIndex").get()).size).toBe(0);
  });
});

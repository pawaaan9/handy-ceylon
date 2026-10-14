import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "@/features/auth/constants";
import { signUpSchema } from "@/features/auth/schemas";
import { createCustomerAccount } from "@/features/auth/server/accounts";
import * as dal from "@/features/auth/server/dal";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

import { resetEmulators, sessionFor, validSignUp } from "./helpers";

// A real session cookie from the Auth emulator, served through a fake cookie jar.
const cookieJar = vi.hoisted(() => new Map<string, string>());
// Outside a Next.js request there is no prerender to opt out of.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
}));

async function signedInCustomer() {
  const { uid } = await createCustomerAccount(signUpSchema.parse(validSignUp()));
  cookieJar.set(SESSION_COOKIE_NAME, await sessionFor("nimal@example.com", "Valid1Password"));
  return uid;
}

/** next/navigation's redirect() throws an error whose digest holds the URL. */
async function redirectTarget(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return digest.split(";")[2] ?? null;
  }
}

beforeEach(async () => {
  cookieJar.clear();
  await resetEmulators();
});

describe("Data Access Layer", () => {
  it("returns null without a valid session cookie", async () => {
    expect(await dal.getCurrentUser()).toBeNull();
    cookieJar.set(SESSION_COOKIE_NAME, "forged.cookie.value");
    expect(await dal.getCurrentUser()).toBeNull();
  });

  it("reads the role from Firestore, not from token claims", async () => {
    const uid = await signedInCustomer();
    // A tampered or stale claim must not grant admin on the server.
    await adminAuth().setCustomUserClaims(uid, { role: "admin" });
    cookieJar.set(SESSION_COOKIE_NAME, await sessionFor("nimal@example.com", "Valid1Password"));
    expect((await dal.getCurrentUser())?.role).toBe("customer");
  });

  it("treats suspended accounts as signed out", async () => {
    const uid = await signedInCustomer();
    await adminDb().doc(`users/${uid}`).update({ accountStatus: "suspended" });
    expect(await dal.getCurrentUser()).toBeNull();
  });

  it("rejects revoked sessions", async () => {
    const uid = await signedInCustomer();
    await new Promise((r) => setTimeout(r, 1100)); // revocation has 1s granularity
    await adminAuth().revokeRefreshTokens(uid);
    expect(await dal.getCurrentUser()).toBeNull();
  });

  it("re-checks Firebase Auth for email verification", async () => {
    const uid = await signedInCustomer();
    expect((await dal.getCurrentUser())?.emailVerified).toBe(false);
    await adminAuth().updateUser(uid, { emailVerified: true });
    expect(await dal.isEmailVerified(uid)).toBe(true);
  });
});

describe("route protection (requireRole)", () => {
  it("sends unauthenticated users to login with a return path", async () => {
    expect(await redirectTarget(dal.requireRole(["customer"], { from: "/customer/profile" }))).toBe(
      "/login?next=%2Fcustomer%2Fprofile",
    );
  });

  it("sends customers away from technician and admin areas", async () => {
    await signedInCustomer();
    expect(await redirectTarget(dal.requireRole(["technician"]))).toBe("/customer/dashboard");
    expect(await redirectTarget(dal.requireRole(["admin"]))).toBe("/customer/dashboard");
    expect(await redirectTarget(dal.requireRole(["customer"]))).toBeNull();
  });

  it("server actions reject callers without the role", async () => {
    await signedInCustomer();
    await expect(dal.requireActionUser(["admin"])).rejects.toMatchObject({ status: 403 });
    cookieJar.clear();
    await expect(dal.requireActionUser()).rejects.toMatchObject({ status: 401 });
  });
});

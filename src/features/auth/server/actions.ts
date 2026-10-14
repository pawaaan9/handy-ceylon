"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import { runAction, type ActionResult } from "@/lib/action-result";
import { AuthError, UserFacingError } from "@/lib/errors";

import {
  DEFAULT_SESSION_DURATION_MS,
  MAX_SIGN_IN_AGE_SECONDS,
  REMEMBER_ME_DURATION_MS,
  SESSION_COOKIE_NAME,
} from "../constants";
import { authRoutes, postLoginPath } from "../redirects";
import { userRoleSchema } from "../roles";
import { completeProfileSchema, signUpSchema } from "../schemas";
import { createCustomerAccount, provisionCustomer } from "./accounts";
import { setRoleClaim } from "./claims";
import { getApplicationStatus, getCurrentUser, requireActionUser } from "./dal";

const idTokenSchema = z.string().min(20).max(8192);

/** Public sign-up. Always creates a customer; role is not an input. */
export async function signUpAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const input = signUpSchema.parse(values);
    await createCustomerAccount(input);
    return undefined;
  });
}

const createSessionSchema = z.object({
  idToken: idTokenSchema,
  remember: z.boolean(),
  next: z.string().max(2048).nullish(),
});

/**
 * Exchanges a fresh Firebase ID token for an httpOnly session cookie.
 * Returns where the user should go based on their authoritative role.
 */
export async function createSessionAction(
  values: unknown,
): Promise<ActionResult<{ redirectTo: string; refreshToken: boolean }>> {
  return runAction(async () => {
    const { idToken, remember, next } = createSessionSchema.parse(values);
    const auth = adminAuth();

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch {
      throw new AuthError("Your sign-in could not be verified. Please try again.", 401);
    }
    if (Date.now() / 1000 - decoded.auth_time > MAX_SIGN_IN_AGE_SECONDS) {
      throw new AuthError("Please sign in again to continue.", 401);
    }

    const snap = await adminDb().collection(collections.users).doc(decoded.uid).get();
    if (snap.exists && snap.get("accountStatus") !== "active") {
      throw new UserFacingError(
        "This account has been suspended. Please contact Handy Ceylon support.",
      );
    }

    // Keep Security Rules claims aligned with the authoritative Firestore role.
    let refreshToken = false;
    const role = snap.exists ? userRoleSchema.parse(snap.get("role")) : null;
    if (role && decoded.role !== role) {
      await setRoleClaim(decoded.uid, role);
      refreshToken = true;
    }

    const expiresIn = remember ? REMEMBER_ME_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    (await cookies()).set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // Without "remember me" the cookie ends with the browser session.
      ...(remember ? { maxAge: expiresIn / 1000 } : {}),
    });

    const applicationStatus = role === "customer" ? await getApplicationStatus(decoded.uid) : null;
    return {
      redirectTo: role ? postLoginPath({ role, applicationStatus }, next) : authRoutes.completeProfile,
      refreshToken,
    };
  });
}

export async function signOutAction(): Promise<ActionResult> {
  return runAction(async () => {
    (await cookies()).delete(SESSION_COOKIE_NAME);
    return undefined;
  });
}

/**
 * Re-establishes the browser SDK sign-in from a valid server session (e.g. a
 * new tab when the client used session persistence). The custom token carries
 * no extra claims; the user's real claims are applied by Firebase.
 */
export async function restoreClientSessionAction(): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(undefined, { allowIncomplete: true });
    return { token: await adminAuth().createCustomToken(user.uid) };
  });
}

/** Creates the customer profile for an Auth account that lacks one. */
export async function completeProfileAction(
  values: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AuthError("Your session has expired. Please log in again.", 401);
    if (user.role) throw new UserFacingError("Your account is already set up.");
    const input = completeProfileSchema.parse(values);
    await provisionCustomer(user.uid, {
      fullName: input.fullName,
      email: user.email,
      phoneNumber: input.phoneNumber,
    });
    await adminAuth().updateUser(user.uid, { displayName: input.fullName });
    return { redirectTo: postLoginPath({ role: "customer" }, null) };
  });
}

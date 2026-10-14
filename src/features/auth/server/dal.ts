import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type { TechnicianApplicationStatus } from "@/features/technicians/types";
import { AuthError } from "@/lib/errors";

import { SESSION_COOKIE_NAME } from "../constants";
import { authRoutes, homePathFor } from "../redirects";
import type { AccountStatus, UserRole } from "../roles";

/**
 * Data Access Layer for identity. Every protected page and Server Action goes
 * through here: the session cookie proves *who* the caller is, and the
 * users/{uid} document (server-written) says *what* they may do. Token claims
 * are never trusted for authorization on the server.
 */
export type CurrentUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  /** null = Auth account exists but the Handy Ceylon profile was never created. */
  role: UserRole | null;
  accountStatus: AccountStatus;
  displayName: string;
  phoneNumber: string | null;
  photoURL: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks depend on the current time (cookie expiry, revocation), so
  // they must never run during a prerender or prefetch — only per request.
  await connection();
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  let decoded;
  try {
    // checkRevoked: disabled users and revoked sessions are rejected immediately.
    decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }

  // The cookie's verification flag is a snapshot from sign-in; unverified users
  // re-check Firebase Auth so verifying takes effect without a new session.
  let emailVerified = decoded.email_verified === true;
  if (!emailVerified) {
    emailVerified = (await adminAuth().getUser(decoded.uid)).emailVerified;
  }

  const snap = await adminDb().collection(collections.users).doc(decoded.uid).get();
  if (!snap.exists) {
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      emailVerified,
      role: null,
      accountStatus: "active",
      displayName: typeof decoded.name === "string" ? decoded.name : "",
      phoneNumber: null,
      photoURL: null,
    };
  }

  const data = snap.data()!;
  if (data.accountStatus !== "active") return null;

  return {
    uid: decoded.uid,
    email: data.email,
    emailVerified,
    role: data.role,
    accountStatus: data.accountStatus,
    displayName: data.displayName,
    phoneNumber: data.phoneNumber ?? null,
    photoURL: data.photoURL ?? null,
  };
});

export const getApplicationStatus = cache(
  async (uid: string): Promise<TechnicianApplicationStatus | null> => {
    const snap = await adminDb().collection(collections.technicianApplications).doc(uid).get();
    return snap.exists ? (snap.get("applicationStatus") as TechnicianApplicationStatus) : null;
  },
);

/** Authoritative check straight from Firebase Auth, for sensitive actions. */
export async function isEmailVerified(uid: string): Promise<boolean> {
  return (await adminAuth().getUser(uid)).emailVerified;
}

export async function homePathForUser(user: CurrentUser): Promise<string> {
  const applicationStatus =
    user.role === "customer" ? await getApplicationStatus(user.uid) : null;
  return homePathFor({ role: user.role, applicationStatus });
}

type RequireOptions = {
  /** Path to come back to after logging in. */
  from?: string;
  /** Allow users whose profile has not been created yet. */
  allowIncomplete?: boolean;
};

/** For pages: redirects instead of throwing. */
export async function requireUser(options: RequireOptions = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = options.from ? `?next=${encodeURIComponent(options.from)}` : "";
    redirect(`${authRoutes.login}${next}`);
  }
  if (!user.role && !options.allowIncomplete) redirect(authRoutes.completeProfile);
  return user;
}

export async function requireRole(
  roles: readonly UserRole[],
  options: Omit<RequireOptions, "allowIncomplete"> = {},
): Promise<CurrentUser & { role: UserRole }> {
  const user = await requireUser(options);
  if (!user.role || !roles.includes(user.role)) redirect(await homePathForUser(user));
  return user as CurrentUser & { role: UserRole };
}

/** For Server Actions: throws so the action returns an error result. */
export async function requireActionUser(
  roles?: readonly UserRole[],
  { allowIncomplete = false }: { allowIncomplete?: boolean } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has expired. Please log in again.", 401);
  if (!user.role && !allowIncomplete) {
    throw new AuthError("Finish setting up your account first.", 403);
  }
  if (roles && (!user.role || !roles.includes(user.role))) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
  return user;
}

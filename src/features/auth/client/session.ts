"use client";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseClient } from "@/lib/firebase/client";
import type { ActionResult } from "@/lib/action-result";

import { createSessionAction, signOutAction } from "../server/actions";

/** Browser persistence mirrors the server cookie: remembered or tab/browser-scoped. */
export async function signInWithPassword(email: string, password: string, remember: boolean) {
  const { auth } = getFirebaseClient();
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/** Creates the server session cookie from the signed-in browser user. */
export async function establishServerSession(
  user: User,
  remember: boolean,
  next?: string | null,
): Promise<ActionResult<{ redirectTo: string; refreshToken: boolean }>> {
  const idToken = await user.getIdToken();
  const result = await createSessionAction({ idToken, remember, next });
  if (!result.ok) {
    await signOut(getFirebaseClient().auth);
    return result;
  }
  // The server may have just updated role claims used by Security Rules.
  if (result.data.refreshToken) await user.getIdToken(true);
  return result;
}

/** Ends both the server session and the browser SDK sign-in. */
export async function signOutEverywhere(): Promise<void> {
  await Promise.allSettled([signOut(getFirebaseClient().auth), signOutAction()]);
}

/** Absolute URL on this origin for Firebase email action continue links. */
export function continueUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

/**
 * Full page load after the session changes (sign-in, sign-up, sign-out), so
 * nothing rendered or prefetched for the previous identity is reused.
 */
export function navigateAfterAuthChange(path: string, { replace = false } = {}): void {
  if (replace) window.location.replace(path);
  else window.location.assign(path);
}

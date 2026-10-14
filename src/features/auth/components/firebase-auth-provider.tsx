"use client";

import {
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signInWithCustomToken,
  type User,
} from "firebase/auth";
import { createContext, use, useEffect, useRef, useState } from "react";

import { isFirebaseClientConfigured } from "@/config/env.client";
import { getFirebaseClient } from "@/lib/firebase/client";

import { restoreClientSessionAction } from "../server/actions";
import type { UserRole } from "../roles";

type ClientAuthState =
  | { status: "loading"; user: null }
  | { status: "ready"; user: User }
  | { status: "error"; user: null; message: string };

const ClientAuthContext = createContext<ClientAuthState | null>(null);

/**
 * Keeps the browser Firebase SDK signed in as the same user as the server
 * session, so client-only operations (Storage uploads, verification emails)
 * work. The server session stays the source of truth: if the browser user is
 * missing or different, it is restored from the session via a custom token.
 */
export function FirebaseAuthProvider({
  uid,
  role,
  children,
}: {
  uid: string;
  role: UserRole | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ClientAuthState>(() =>
    isFirebaseClientConfigured()
      ? { status: "loading", user: null }
      : { status: "error", user: null, message: "Firebase is not configured." },
  );
  const restoring = useRef(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) return;
    const { auth } = getFirebaseClient();

    return onIdTokenChanged(auth, async (user) => {
      if (user && user.uid === uid) {
        const token = await user.getIdTokenResult();
        // Approval or other role changes: pull the new claims for Security Rules.
        if (role && token.claims.role !== role) {
          await user.getIdToken(true);
          return; // onIdTokenChanged fires again with the refreshed token
        }
        setState({ status: "ready", user });
        return;
      }

      if (restoring.current) return;
      restoring.current = true;
      setState({ status: "loading", user: null });
      try {
        const result = await restoreClientSessionAction();
        if (!result.ok) throw new Error(result.error);
        await setPersistence(auth, browserSessionPersistence);
        await signInWithCustomToken(auth, result.data.token);
      } catch {
        setState({
          status: "error",
          user: null,
          message: "Your session needs to be refreshed. Please log in again.",
        });
      } finally {
        restoring.current = false;
      }
    });
  }, [uid, role]);

  return <ClientAuthContext value={state}>{children}</ClientAuthContext>;
}

const signedOut: ClientAuthState = {
  status: "error",
  user: null,
  message: "Log in to continue.",
};

/** Outside a provider (no server session) the browser SDK is treated as signed out. */
export function useClientAuth(): ClientAuthState {
  return use(ClientAuthContext) ?? signedOut;
}

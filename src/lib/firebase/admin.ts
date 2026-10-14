import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

import { getServerEnv } from "@/config/env.server";

/**
 * Firebase Admin SDK — bypasses Security Rules, so it must only run on the
 * server (Route Handlers, Server Actions, scripts). `server-only` turns any
 * accidental client import into a build error.
 */
function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const env = getServerEnv();

  // Emulators accept unauthenticated admin calls; no credentials needed.
  if (usingEmulators()) {
    return initializeApp({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  }

  const credential =
    env.FIREBASE_ADMIN_CLIENT_EMAIL && env.FIREBASE_ADMIN_PRIVATE_KEY
      ? cert({
          projectId: env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
        })
      : applicationDefault();

  return initializeApp({
    credential,
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
}

export function usingEmulators(): boolean {
  return Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
  );
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminStorage(): Storage {
  return getStorage(getAdminApp());
}

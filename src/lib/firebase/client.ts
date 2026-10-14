"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

import { getClientEnv } from "@/config/env.client";

/**
 * Browser Firebase SDK. Used for sign-in, realtime reads allowed by Security
 * Rules, chat messages and media uploads. Privileged writes (roles, statuses,
 * prices, reviews) go through server code using the Admin SDK instead.
 */
type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

let client: FirebaseClient | null = null;

export function getFirebaseClient(): FirebaseClient {
  if (client) return client;

  const env = getClientEnv();
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }

  client = { app, auth, db, storage };
  return client;
}

// Grants (or revokes) the administrator role for an existing Firebase Auth user.
// This is the ONLY way to create an admin; the app exposes no admin sign-up.
//
// Usage (run on a trusted machine — never in the browser or CI logs):
//   npm run admin:grant -- someone@example.com
//   npm run admin:grant -- someone@example.com --revoke
//
// Credentials come from .env.local (FIREBASE_ADMIN_*) or
// GOOGLE_APPLICATION_CREDENTIALS. Against emulators, set FIREBASE_AUTH_EMULATOR_HOST
// and FIRESTORE_EMULATOR_HOST instead.

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");

if (!email) {
  console.error("Usage: npm run admin:grant -- <email> [--revoke]");
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const usingEmulators = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
);

initializeApp({
  projectId,
  ...(usingEmulators
    ? {}
    : {
        credential:
          clientEmail && privateKey
            ? cert({ projectId, clientEmail, privateKey })
            : applicationDefault(),
      }),
});

const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(`No Firebase Auth user exists for ${email}. Sign up first, then rerun.`);
  process.exit(1);
}

if (!revoke && !user.emailVerified) {
  console.error(`${email} has not verified their email. Verify it before granting admin.`);
  process.exit(1);
}

const userRef = db.collection("users").doc(user.uid);
const snap = await userRef.get();
const role = revoke ? "customer" : "admin";

if (revoke && snap.get("role") !== "admin") {
  console.error(`${email} is not an administrator.`);
  process.exit(1);
}

// Firestore is authoritative for server checks; the claim serves Security Rules.
await userRef.set(
  {
    uid: user.uid,
    role,
    accountStatus: snap.get("accountStatus") ?? "active",
    email: user.email ?? null,
    displayName: snap.get("displayName") ?? user.displayName ?? email,
    phoneNumber: snap.get("phoneNumber") ?? null,
    photoURL: snap.get("photoURL") ?? null,
    photoPath: snap.get("photoPath") ?? null,
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role });
// End existing sessions so the change applies everywhere on next sign-in.
await auth.revokeRefreshTokens(user.uid);

console.log(
  revoke
    ? `Revoked admin from ${email} (${user.uid}); they are now a customer.`
    : `Granted admin to ${email} (${user.uid}). They must log in again.`,
);

// Grants the administrator role to an existing Firebase Auth user.
// This is the ONLY way to create an admin; the app never exposes it.
//
// Usage:
//   node --env-file=.env.local scripts/grant-admin.mjs someone@example.com
//   (or set GOOGLE_APPLICATION_CREDENTIALS instead of the FIREBASE_ADMIN_* vars)

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/grant-admin.mjs <email>");
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

initializeApp({
  projectId,
  credential:
    clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault(),
});

const auth = getAuth();
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "admin" });
await getFirestore()
  .collection("users")
  .doc(user.uid)
  .set(
    {
      uid: user.uid,
      role: "admin",
      email: user.email ?? null,
      displayName: user.displayName ?? email,
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
// Force existing sessions to pick up the new claim.
await auth.revokeRefreshTokens(user.uid);

console.log(`Granted admin to ${email} (${user.uid}). They must sign in again.`);

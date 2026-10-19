// Grants (or revokes) the administrator role for an existing Firebase Auth user.
// This is the ONLY way to create an admin; the app exposes no admin sign-up.
//
// Usage (run on a trusted machine — never in the browser or CI logs):
//   npm run admin:grant -- someone@example.com
//   npm run admin:grant -- someone@example.com --revoke
//   npm run admin:grant -- admin@example.com --create [--name "Full Name"]
//
// --create makes a new email/password account for a dedicated admin login
// (marked verified, since you are creating it yourself). The password is read
// from ADMIN_PASSWORD or a hidden prompt — never pass it as an argument.
//
// Credentials come from .env.local (FIREBASE_ADMIN_*) or
// GOOGLE_APPLICATION_CREDENTIALS. Against emulators, set FIREBASE_AUTH_EMULATOR_HOST
// and FIRESTORE_EMULATOR_HOST instead.

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const nameIndex = args.indexOf("--name");
const displayNameArg = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
const email = args.find((a, i) => !a.startsWith("--") && i !== nameIndex + 1);
const revoke = args.includes("--revoke");
const create = args.includes("--create");

/** Reads a line without echoing it to the terminal. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

/** Same rules as the app's sign-up form. */
function passwordProblem(password) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Include a lowercase letter, an uppercase letter and a number.";
  }
  return null;
}

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
  if (!create || revoke) {
    console.error(`No Firebase Auth user exists for ${email}. Sign up first, or rerun with --create.`);
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD || (await promptHidden(`Password for ${email}: `));
  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  user = await auth.createUser({
    email: email.toLowerCase(),
    password,
    emailVerified: true,
    displayName: displayNameArg || "Handy Ceylon Admin",
  });
  console.log(`Created login ${user.email} (${user.uid}).`);
}
if (create && user.metadata.creationTime && Date.now() - Date.parse(user.metadata.creationTime) > 60_000) {
  console.log(`${email} already had an account; its password was left unchanged.`);
}

if (!revoke && !user.emailVerified) {
  console.error(`${email} has not verified their email. Verify it before granting admin.`);
  process.exit(1);
}

const adminRef = db.collection("admins").doc(user.uid);
const adminSnap = await adminRef.get();

if (revoke) {
  if (!adminSnap.exists) {
    console.error(`${email} is not an administrator.`);
    process.exit(1);
  }
  await adminRef.delete();
  // Fall back to the next role collection that still holds this uid.
  const [technician, customer] = await db.getAll(
    db.collection("technicians").doc(user.uid),
    db.collection("customers").doc(user.uid),
  );
  const nextRole = technician.exists ? "technician" : customer.exists ? "customer" : null;
  const claims = { ...user.customClaims };
  if (nextRole) claims.role = nextRole;
  else delete claims.role;
  await auth.setCustomUserClaims(user.uid, claims);
} else {
  // Reuse contact details from an existing customer record if there is one.
  const customer = await db.collection("customers").doc(user.uid).get();
  await adminRef.set(
    {
      uid: user.uid,
      accountStatus: "active",
      displayName: adminSnap.get("displayName") ?? customer.get("displayName") ?? user.displayName ?? email,
      email: (user.email ?? email).toLowerCase(),
      phoneNumber: customer.get("phoneNumber") ?? user.phoneNumber ?? null,
      photoURL: customer.get("photoURL") ?? null,
      photoPath: customer.get("photoPath") ?? null,
      grantedBy: "grant-admin-script",
      grantedAt: FieldValue.serverTimestamp(),
      ...(adminSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  // The claim serves Security Rules; the admins collection is authoritative.
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "admin" });
}
// End existing sessions so the change applies everywhere on next sign-in.
await auth.revokeRefreshTokens(user.uid);

console.log(
  revoke
    ? `Revoked admin from ${email} (${user.uid}).`
    : `Granted admin to ${email} (${user.uid}). They must log in again.`,
);

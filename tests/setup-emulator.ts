// Emulator tests must never touch a real Firebase project.
const required = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Emulator tests need ${missing.join(", ")}. Run them with "npm run test:emulators".`,
  );
}

process.env.FIREBASE_ADMIN_PROJECT_ID = "demo-handy-ceylon";
process.env.FIREBASE_STORAGE_BUCKET = "demo-handy-ceylon.appspot.com";
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

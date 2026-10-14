import { adminAuth, adminStorage } from "@/lib/firebase/admin";

export const PROJECT_ID = "demo-handy-ceylon";

export async function resetEmulators() {
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestore = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${auth}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  await fetch(
    `http://${firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  const [files] = await adminStorage().bucket().getFiles();
  await Promise.all(files.map((f) => f.delete()));
}

/** Real email/password sign-in against the Auth emulator → ID token. */
export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as { idToken?: string; error?: { message: string } };
  if (!body.idToken) throw new Error(`sign-in failed: ${body.error?.message}`);
  return body.idToken;
}

export async function sessionFor(email: string, password: string) {
  const idToken = await signIn(email, password);
  return adminAuth().createSessionCookie(idToken, { expiresIn: 60 * 60 * 1000 });
}

export async function uploadAs(path: string, contentType: string, bytes = Buffer.from("test")) {
  await adminStorage().bucket().file(path).save(bytes, { contentType });
}

export const validSignUp = (overrides: Partial<Record<string, unknown>> = {}) => ({
  fullName: "Nimal Perera",
  email: "nimal@example.com",
  phoneNumber: "+94771234567",
  password: "Valid1Password",
  confirmPassword: "Valid1Password",
  acceptTerms: true,
  ...overrides,
});


/** Minimal active catalogue entries for tests that select categories. */
export async function seedCategory(id: string, { active = true } = {}) {
  const { adminDb } = await import("@/lib/firebase/admin");
  await adminDb()
    .doc(`serviceCategories/${id}`)
    .set({ slug: id, name: id, description: id, icon: "wrench", keywords: [], sortOrder: 0, subcategories: [], active });
}

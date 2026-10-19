import { addressInputSchema } from "@/features/addresses/schemas";
import { createAddress } from "@/features/addresses/server/repository";
import { signUpSchema } from "@/features/auth/schemas";
import { createCustomerAccount } from "@/features/auth/server/accounts";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

export const PROJECT_ID = "demo-handy-ceylon";

export async function resetEmulators() {
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const firestore = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${auth}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  await fetch(`http://${firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: "DELETE",
  });
  const [files] = await adminStorage().bucket().getFiles();
  await Promise.all(files.map((f) => f.delete()));
}

export async function createCustomer(email: string, phoneNumber: string) {
  const { uid } = await createCustomerAccount(
    signUpSchema.parse({
      fullName: "Nimal Perera",
      email,
      phoneNumber,
      password: "Valid1Password",
      confirmPassword: "Valid1Password",
      acceptTerms: true,
    }),
  );
  return uid;
}

export const addressInput = (overrides: Record<string, unknown> = {}) =>
  addressInputSchema.parse({
    label: "Home",
    recipientName: "Nimal Perera",
    contactNumber: "0771234567",
    houseOrBuilding: "No. 12",
    street: "Temple Road",
    city: "Kandy",
    district: "Kandy",
    postalCode: "20000",
    directions: "Blue gate",
    latitude: "",
    longitude: "",
    makeDefault: false,
    ...overrides,
  });

export async function createCustomerWithAddress(email: string, phoneNumber: string) {
  const uid = await createCustomer(email, phoneNumber);
  const addressId = await createAddress(uid, addressInput());
  return { uid, addressId };
}

/** Active category with one active service (and optionally an inactive one). */
export async function seedCatalogue() {
  const db = adminDb();
  const now = new Date();
  await db.doc("serviceCategories/plumbing").set({
    slug: "plumbing",
    name: "Plumbing",
    description: "Pipes and taps",
    icon: "wrench",
    imageURL: null,
    keywords: [],
    active: true,
    sortOrder: 0,
    subcategories: [{ id: "leaks", name: "Leaks", sortOrder: 0, active: true }],
    createdAt: now,
    updatedAt: now,
  });
  await db.doc("serviceCategories/electrical").set({
    slug: "electrical",
    name: "Electrical",
    description: "Wiring",
    icon: "zap",
    imageURL: null,
    keywords: [],
    active: true,
    sortOrder: 1,
    subcategories: [],
    createdAt: now,
    updatedAt: now,
  });
  const service = (categoryId: string, subcategoryId: string | null, name: string, active = true) => ({
    categoryId,
    subcategoryId,
    name,
    description: name,
    active,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db.doc("services/leak-repair").set(service("plumbing", "leaks", "Leak repair"));
  await db.doc("services/retired-service").set(service("plumbing", null, "Retired", false));
  await db.doc("services/rewiring").set(service("electrical", null, "Rewiring"));
}

export async function uploadAs(path: string, contentType: string, bytes: Buffer | Uint8Array = Buffer.from("test")) {
  await adminStorage().bucket().file(path).save(Buffer.from(bytes), { contentType, resumable: false });
}

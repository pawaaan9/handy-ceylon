// Seeds the service catalogue (serviceCategories + services) into Firestore
// from scripts/data/service-catalogue.json.
//
// Safe by design:
//   • Idempotent upserts — run it as often as you like.
//   • Never deletes documents.
//   • Never re-activates something an admin switched off: `active` is only
//     set when a document is first created.
//   • --dry-run prints what would change without writing.
//
// Usage:
//   npm run seed:catalogue -- --dry-run
//   npm run seed:catalogue
// Against emulators: set FIRESTORE_EMULATOR_HOST (credentials are then not needed).

import { readFileSync } from "node:fs";

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const dryRun = process.argv.includes("--dry-run");
const dataPath = new URL("./data/service-catalogue.json", import.meta.url);
const { categories, services } = JSON.parse(readFileSync(dataPath, "utf8"));

// ---- validate the file before touching Firestore ----
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const problems = [];
const categoryIds = new Set();
for (const c of categories) {
  if (!slug.test(c.id)) problems.push(`category id "${c.id}" is not a slug`);
  if (categoryIds.has(c.id)) problems.push(`duplicate category "${c.id}"`);
  categoryIds.add(c.id);
  if (!c.name || !c.description || !c.icon) problems.push(`category "${c.id}" is missing name/description/icon`);
  for (const s of c.subcategories ?? []) {
    if (!slug.test(s.id) || !s.name) problems.push(`category "${c.id}" has an invalid subcategory`);
  }
}
const serviceIds = new Set();
for (const s of services) {
  if (!slug.test(s.id)) problems.push(`service id "${s.id}" is not a slug`);
  if (serviceIds.has(s.id)) problems.push(`duplicate service "${s.id}"`);
  serviceIds.add(s.id);
  const category = categories.find((c) => c.id === s.categoryId);
  if (!category) problems.push(`service "${s.id}" references unknown category "${s.categoryId}"`);
  if (s.subcategoryId && !category?.subcategories?.some((sub) => sub.id === s.subcategoryId)) {
    problems.push(`service "${s.id}" references unknown subcategory "${s.subcategoryId}"`);
  }
  if (!s.name || !s.description) problems.push(`service "${s.id}" is missing name/description`);
}
if (problems.length > 0) {
  console.error(`Catalogue file is invalid:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

// ---- connect ----
const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

initializeApp({
  projectId,
  ...(usingEmulator
    ? {}
    : {
        credential:
          clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
      }),
});
const db = getFirestore();
console.log(
  `${dryRun ? "[dry run] " : ""}Seeding catalogue into ${usingEmulator ? "the Firestore emulator" : `project "${projectId}"`}…`,
);

async function upsert(collection, id, buildFields) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (dryRun) return snap.exists ? "update" : "create";
  await ref.set(
    {
      ...buildFields(snap),
      updatedAt: FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { active: true, createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
  return snap.exists ? "update" : "create";
}

const tally = { create: 0, update: 0 };
for (const c of categories) {
  const result = await upsert("serviceCategories", c.id, (snap) => ({
    slug: c.id,
    name: c.name,
    description: c.description,
    icon: c.icon,
    imageURL: c.imageURL ?? null,
    keywords: c.keywords ?? [],
    sortOrder: c.sortOrder,
    // Existing subcategories keep the active flag an admin may have changed.
    subcategories: (c.subcategories ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder ?? 0,
      active: (snap.get("subcategories") ?? []).find((e) => e.id === s.id)?.active ?? true,
    })),
  }));
  tally[result] += 1;
}
for (const s of services) {
  const result = await upsert("services", s.id, () => ({
    categoryId: s.categoryId,
    subcategoryId: s.subcategoryId ?? null,
    name: s.name,
    description: s.description,
    sortOrder: s.sortOrder,
  }));
  tally[result] += 1;
}

console.log(
  `${dryRun ? "Would create" : "Created"} ${tally.create}, ${dryRun ? "would update" : "updated"} ${tally.update} ` +
    `(${categories.length} categories, ${services.length} services). Nothing was deleted.`,
);
if (!dryRun) {
  console.log("Pages refresh within 15 minutes, or immediately via Admin → Refresh catalogue.");
}

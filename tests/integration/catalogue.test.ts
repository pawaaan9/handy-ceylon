import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { beforeEach, describe, expect, it } from "vitest";

import {
  assertActiveCategoryIds,
  getSelectableService,
  loadActiveCatalogue,
} from "@/features/catalogue/server/repository";
import { adminDb } from "@/lib/firebase/admin";

import { resetEmulators } from "./helpers";

beforeEach(resetEmulators);

const run = promisify(execFile);
const seed = (...args: string[]) =>
  run("node", ["scripts/seed-catalogue.mjs", ...args], {
    env: { ...process.env, FIREBASE_ADMIN_PROJECT_ID: "demo-handy-ceylon" },
  });

async function seedFixture() {
  const db = adminDb();
  const base = { description: "d", icon: "wrench", keywords: [], imageURL: null };
  await db.doc("serviceCategories/plumbing").set({
    ...base,
    name: "Plumbing",
    sortOrder: 2,
    active: true,
    subcategories: [
      { id: "repairs", name: "Repairs", sortOrder: 1, active: true },
      { id: "legacy", name: "Legacy", sortOrder: 2, active: false },
    ],
  });
  await db.doc("serviceCategories/electrical").set({ ...base, name: "Electrical", sortOrder: 1, active: true, subcategories: [] });
  await db.doc("serviceCategories/retired").set({ ...base, name: "Retired", sortOrder: 0, active: false, subcategories: [] });
  const svc = (categoryId: string, subcategoryId: string | null, active = true) => ({
    categoryId,
    subcategoryId,
    name: `${categoryId}-${subcategoryId}`,
    description: "d",
    sortOrder: 0,
    active,
  });
  await db.doc("services/leak").set(svc("plumbing", "repairs"));
  await db.doc("services/legacy-fix").set(svc("plumbing", "legacy"));
  await db.doc("services/disabled").set(svc("plumbing", null, false));
  await db.doc("services/orphan").set(svc("retired", null));
  await db.doc("services/wiring").set(svc("electrical", null));
}

describe("catalogue repository", () => {
  it("returns only active categories, subcategories and services, in sort order", async () => {
    await seedFixture();
    const { categories, services } = await loadActiveCatalogue();
    expect(categories.map((c) => c.id)).toEqual(["electrical", "plumbing"]);
    expect(categories[1].subcategories.map((s) => s.id)).toEqual(["repairs"]);
    // Inactive service, service in an inactive subcategory, and service of an
    // inactive category are all excluded.
    expect(services.map((s) => s.id).sort()).toEqual(["leak", "wiring"]);
  });

  it("only active categories are selectable", async () => {
    await seedFixture();
    await expect(assertActiveCategoryIds(["plumbing", "electrical"])).resolves.toBeUndefined();
    await expect(assertActiveCategoryIds(["plumbing", "retired"])).rejects.toThrow("no longer available");
    await expect(assertActiveCategoryIds(["unknown"])).rejects.toThrow("no longer available");
  });

  it("only active services are selectable", async () => {
    await seedFixture();
    await expect(getSelectableService("leak")).resolves.toMatchObject({ categoryId: "plumbing" });
    for (const id of ["disabled", "orphan", "legacy-fix", "missing"]) {
      await expect(getSelectableService(id)).rejects.toThrow("not available");
    }
  });
});

describe("seed script", () => {
  it("validates, seeds and is idempotent without re-activating disabled entries", async () => {
    const dry = await seed("--dry-run");
    expect(dry.stdout).toContain("Would create");
    expect((await adminDb().collection("serviceCategories").get()).size).toBe(0);

    await seed();
    const categories = await adminDb().collection("serviceCategories").get();
    const services = await adminDb().collection("services").get();
    expect(categories.size).toBeGreaterThanOrEqual(8);
    expect(services.size).toBeGreaterThan(categories.size);
    expect(categories.docs.map((d) => d.id)).toEqual(
      expect.arrayContaining(["plumbing", "electrical", "cleaning", "carpentry", "painting", "air-conditioning", "appliance-repair", "gardening"]),
    );

    // An admin disables a category and a subcategory, then the seed runs again.
    await adminDb().doc("serviceCategories/gardening").update({ active: false });
    const plumbing = (await adminDb().doc("serviceCategories/plumbing").get()).data()!;
    await adminDb()
      .doc("serviceCategories/plumbing")
      .update({ subcategories: plumbing.subcategories.map((s: { id: string }) => ({ ...s, active: s.id !== "repairs" })) });

    const second = await seed();
    expect(second.stdout).toContain("Created 0");
    expect((await adminDb().doc("serviceCategories/gardening").get()).get("active")).toBe(false);
    const subs = (await adminDb().doc("serviceCategories/plumbing").get()).get("subcategories");
    expect(subs.find((s: { id: string }) => s.id === "repairs").active).toBe(false);
    expect((await adminDb().collection("services").get()).size).toBe(services.size);
  });
});

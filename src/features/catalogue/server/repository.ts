import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type { ServiceCategoryDoc, ServiceDoc } from "@/lib/firestore/models";
import { UserFacingError } from "@/lib/errors";

import type { Catalogue, CategoryView, ServiceView } from "../types";

/**
 * Reads the catalogue with the Admin SDK. Only active categories, active
 * subcategories and active services of active categories are ever returned,
 * so inactive entries can't be listed, linked or selected.
 */
export async function loadActiveCatalogue(): Promise<Catalogue> {
  const db = adminDb();
  const [categorySnap, serviceSnap] = await Promise.all([
    db.collection(collections.serviceCategories).where("active", "==", true).get(),
    db.collection(collections.services).where("active", "==", true).get(),
  ]);

  const categories: CategoryView[] = categorySnap.docs
    .map((d) => ({ id: d.id, data: d.data() as ServiceCategoryDoc }))
    .sort((a, b) => a.data.sortOrder - b.data.sortOrder || a.data.name.localeCompare(b.data.name))
    .map(({ id, data }) => ({
      id,
      name: data.name,
      description: data.description,
      icon: data.icon,
      imageURL: data.imageURL ?? null,
      keywords: data.keywords ?? [],
      subcategories: (data.subcategories ?? [])
        .filter((s) => s.active)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({ id: s.id, name: s.name })),
    }));

  const activeCategoryIds = new Set(categories.map((c) => c.id));
  const activeSubcategories = new Map(categories.map((c) => [c.id, new Set(c.subcategories.map((s) => s.id))]));

  const services: ServiceView[] = serviceSnap.docs
    .map((d) => ({ id: d.id, data: d.data() as ServiceDoc }))
    .filter(({ data }) => activeCategoryIds.has(data.categoryId))
    // A service in a disabled subcategory is hidden with it.
    .filter(({ data }) => !data.subcategoryId || activeSubcategories.get(data.categoryId)?.has(data.subcategoryId))
    .sort((a, b) => a.data.sortOrder - b.data.sortOrder || a.data.name.localeCompare(b.data.name))
    .map(({ id, data }) => ({
      id,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId ?? null,
      name: data.name,
      description: data.description,
    }));

  return { categories, services };
}

/**
 * Server-side guard for anything a customer or technician *selects*. Reads
 * Firestore directly (not the page cache) so a just-disabled entry is refused.
 */
export async function assertActiveCategoryIds(ids: readonly string[]): Promise<void> {
  const db = adminDb();
  const refs = ids.map((id) => db.collection(collections.serviceCategories).doc(id));
  const snaps = refs.length ? await db.getAll(...refs) : [];
  const inactive = snaps.filter((s) => !s.exists || s.get("active") !== true);
  if (inactive.length > 0) {
    throw new UserFacingError("One of the selected services is no longer available.", "serviceCategoryIds");
  }
}

export type SelectableService = ServiceView & { categoryName: string; subcategoryName: string | null };

/** Fresh read of one service; refuses it unless it, its category and subcategory are all active. */
export async function getSelectableService(serviceId: string): Promise<SelectableService> {
  const db = adminDb();
  const snap = await db.collection(collections.services).doc(serviceId).get();
  const data = snap.data() as ServiceDoc | undefined;
  if (!data || data.active !== true) throw new UserFacingError("This service is not available.", "serviceId");

  const category = await db.collection(collections.serviceCategories).doc(data.categoryId).get();
  if (category.get("active") !== true) throw new UserFacingError("This service is not available.", "serviceId");
  let subcategoryName: string | null = null;
  if (data.subcategoryId) {
    const sub = ((category.get("subcategories") ?? []) as ServiceCategoryDoc["subcategories"]).find(
      (s) => s.id === data.subcategoryId,
    );
    if (!sub?.active) throw new UserFacingError("This service is not available.", "serviceId");
    subcategoryName = sub.name;
  }
  return {
    id: snap.id,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId ?? null,
    name: data.name,
    description: data.description,
    categoryName: category.get("name") as string,
    subcategoryName,
  };
}

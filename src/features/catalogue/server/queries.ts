import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { CatalogueResult } from "../types";
import { loadActiveCatalogue } from "./repository";

export const CATALOGUE_CACHE_TAG = "service-catalogue";

/**
 * Cached catalogue for pages. Refreshes every 15 minutes, or immediately when
 * an admin runs "Refresh catalogue". Failures are cached only briefly so the
 * pages recover on their own once Firestore is reachable.
 */
export async function getCatalogue(): Promise<CatalogueResult> {
  "use cache";
  cacheTag(CATALOGUE_CACHE_TAG);
  try {
    const catalogue = await loadActiveCatalogue();
    cacheLife({ stale: 300, revalidate: 900, expire: 86_400 });
    return { status: "ok", catalogue };
  } catch (error) {
    console.error("[catalogue] failed to load", error);
    cacheLife("seconds");
    return { status: "unavailable" };
  }
}

/** id → display name for stored category ids; unknown ids fall back to the id. */
export async function getCategoryNamer(): Promise<(id: string) => string> {
  const result = await getCatalogue();
  const names = new Map(result.status === "ok" ? result.catalogue.categories.map((c) => [c.id, c.name]) : []);
  return (id) => names.get(id) ?? id;
}

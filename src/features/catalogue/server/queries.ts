import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { CatalogueResult } from "../types";
import { loadActiveCatalogue } from "./repository";

export const CATALOGUE_CACHE_TAG = "service-catalogue";

const FIRESTORE_NOT_FOUND = 5;
let warnedMissingDatabase = false;

/**
 * A missing Firestore database is a setup step, not a crash: warn once with
 * the fix instead of logging an error on every request.
 */
function reportLoadFailure(error: unknown): void {
  if ((error as { code?: unknown } | null)?.code === FIRESTORE_NOT_FOUND) {
    if (!warnedMissingDatabase) {
      warnedMissingDatabase = true;
      console.warn(
        "[catalogue] Firestore database not found. Create it in the Firebase console " +
          "(Build → Firestore Database → Create database), then run `npm run seed:catalogue`.",
      );
    }
    return;
  }
  console.error("[catalogue] failed to load", error);
}

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
    reportLoadFailure(error);
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

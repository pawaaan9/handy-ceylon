"use server";

import { updateTag } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { CATALOGUE_CACHE_TAG } from "./queries";

/** Admin-only: show catalogue changes (e.g. after seeding) immediately. */
export async function refreshCatalogueAction(): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionUser(["admin"]);
    updateTag(CATALOGUE_CACHE_TAG);
    return undefined;
  });
}

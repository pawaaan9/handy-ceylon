"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { cancelServiceRequestSchema, createServiceRequestSchema } from "../schemas";
import { cancelServiceRequest, createServiceRequest } from "./repository";

/*
 * Only signed-in customers reach the repository, and the owner is always the
 * session's uid. Every field is re-validated here regardless of the browser.
 */

export async function createServiceRequestAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const { id } = await createServiceRequest(user.uid, createServiceRequestSchema.parse(values));
    revalidatePath("/customer", "layout");
    return { id };
  });
}

export async function cancelServiceRequestAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    await cancelServiceRequest(user.uid, cancelServiceRequestSchema.parse(values));
    revalidatePath("/customer", "layout");
    return undefined;
  });
}

"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { sendMessageSchema } from "../schemas";
import { sendMessage } from "./repository";

/** The sender is always the session user; the repository checks they're a participant. */
export async function sendMessageAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer", "technician"]);
    await sendMessage(user.uid, sendMessageSchema.parse(values));
    revalidatePath("/customer", "layout");
    revalidatePath("/technician", "layout");
    return undefined;
  });
}

"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { customerProfileSchema } from "../schemas";
import { updateCustomerProfile } from "./profile";

export async function updateCustomerProfileAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const input = customerProfileSchema.parse(values);
    await updateCustomerProfile(user.uid, input);
    revalidatePath("/customer", "layout");
    return undefined;
  });
}

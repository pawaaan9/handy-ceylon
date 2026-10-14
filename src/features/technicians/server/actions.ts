"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { reviewApplicationSchema, technicianApplicationSchema } from "../schemas";
import { reviewApplication, submitApplication } from "./applications";

export async function submitTechnicianApplicationAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const input = technicianApplicationSchema.parse(values);
    await submitApplication(user, input);
    revalidatePath("/technician", "layout");
    return undefined;
  });
}

export async function reviewTechnicianApplicationAction(values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionUser(["admin"]);
    const input = reviewApplicationSchema.parse(values);
    await reviewApplication(admin, input);
    revalidatePath("/admin", "layout");
    return undefined;
  });
}

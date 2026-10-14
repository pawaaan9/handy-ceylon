"use server";

import { revalidatePath } from "next/cache";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { addressIdSchema, addressInputSchema } from "../schemas";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "./repository";

/*
 * The owner is always the signed-in customer from the session cookie; no
 * action accepts a user id, so one customer can never act on another's data.
 */

function refresh() {
  revalidatePath("/customer", "layout");
}

export async function createAddressAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    const id = await createAddress(user.uid, addressInputSchema.parse(values));
    refresh();
    return { id };
  });
}

export async function updateAddressAction(addressId: unknown, values: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    await updateAddress(user.uid, addressIdSchema.parse(addressId), addressInputSchema.parse(values));
    refresh();
    return undefined;
  });
}

export async function deleteAddressAction(addressId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    await deleteAddress(user.uid, addressIdSchema.parse(addressId));
    refresh();
    return undefined;
  });
}

export async function setDefaultAddressAction(addressId: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(["customer"]);
    await setDefaultAddress(user.uid, addressIdSchema.parse(addressId));
    refresh();
    return undefined;
  });
}

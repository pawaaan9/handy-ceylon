"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActionUser } from "@/features/auth/server/dal";
import { runAction, type ActionResult } from "@/lib/action-result";

import { setProfilePhoto } from "./profile-photo";

/** Any signed-in user may set their own photo; the uid comes from the session. */
export async function setProfilePhotoAction(
  storagePath: unknown,
): Promise<ActionResult<{ photoURL: string }>> {
  return runAction(async () => {
    const user = await requireActionUser();
    const path = z.string().min(1).max(300).parse(storagePath);
    const photoURL = await setProfilePhoto(user.uid, path);
    revalidatePath("/", "layout");
    return { photoURL };
  });
}

import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getDownloadURL } from "firebase-admin/storage";

import { adminAuth, adminStorage } from "@/lib/firebase/admin";
import { storagePaths } from "@/lib/firestore/collections";
import { UserFacingError } from "@/lib/errors";

import { accountRef, resolveAccount } from "./account-store";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Rejects anything outside the caller's own folder (no traversal, no other users). */
export function isOwnedPath(path: string, prefix: string): boolean {
  return (
    path.startsWith(prefix) &&
    path.length > prefix.length &&
    !path.includes("..") &&
    !path.slice(prefix.length).includes("/")
  );
}

/**
 * The browser uploads to avatars/{uid}/* (Storage Rules restrict this to
 * the owner, images, <5 MB). The server then re-checks the object itself and
 * derives the URL — a client-supplied URL is never stored.
 */
export async function setProfilePhoto(uid: string, storagePath: string): Promise<string> {
  const account = await resolveAccount(uid);
  if (!account) throw new UserFacingError("Finish setting up your account first.");
  if (!isOwnedPath(storagePath, storagePaths.avatarPrefix(uid))) {
    throw new UserFacingError("That photo can't be used. Please upload it again.");
  }

  const file = adminStorage().bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new UserFacingError("Upload not found. Please try again.");

  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (!AVATAR_TYPES.includes(metadata.contentType as (typeof AVATAR_TYPES)[number]) || size > MAX_AVATAR_BYTES) {
    await file.delete().catch(() => {});
    throw new UserFacingError("Use a JPG, PNG or WebP image under 5 MB.");
  }

  const photoURL = await getDownloadURL(file);
  const ref = accountRef(account.role, uid);
  const previousPath = account.data.photoPath;

  await ref.update({ photoURL, photoPath: storagePath, updatedAt: FieldValue.serverTimestamp() });
  await adminAuth().updateUser(uid, { photoURL });

  if (previousPath && previousPath !== storagePath) {
    await adminStorage().bucket().file(previousPath).delete().catch(() => {});
  }
  return photoURL;
}

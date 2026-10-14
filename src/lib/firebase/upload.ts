"use client";

import { deleteObject, ref, uploadBytesResumable } from "firebase/storage";

import { getFirebaseClient } from "./client";

/** Uploads with progress. Storage Rules decide whether the path is allowed. */
export function uploadFile(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const { storage } = getFirebaseClient();
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(path),
    );
  });
}

export async function deleteFile(path: string): Promise<void> {
  await deleteObject(ref(getFirebaseClient().storage, path));
}

/** Timestamped, filesystem-safe object name that keeps the original extension. */
export function safeObjectName(file: File): string {
  const base = file.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return `${Date.now()}-${base || "file"}`;
}

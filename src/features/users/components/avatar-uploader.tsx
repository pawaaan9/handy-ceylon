"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useClientAuth } from "@/features/auth/components/firebase-auth-provider";
import { storagePaths } from "@/lib/firestore/collections";
import { initials } from "@/lib/format";
import { safeObjectName, uploadFile } from "@/lib/firebase/upload";

import { setProfilePhotoAction } from "../server/actions";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUploader({
  uid,
  name,
  photoURL,
  onUploaded,
}: {
  uid: string;
  name: string;
  photoURL: string | null;
  onUploaded?: (url: string) => void;
}) {
  const router = useRouter();
  const clientAuth = useClientAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(photoURL);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return setError("The image must be smaller than 5 MB.");

    setProgress(0);
    try {
      const path = await uploadFile(
        `${storagePaths.avatarPrefix(uid)}${safeObjectName(file)}`,
        file,
        setProgress,
      );
      const result = await setProfilePhotoAction(path);
      if (!result.ok) throw new Error(result.error);
      setPreview(result.data.photoURL);
      onUploaded?.(result.data.photoURL);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Upload failed. Please try again.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = progress !== null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar className="size-20 border">
          {preview ? <AvatarImage src={preview} alt="" className="object-cover" /> : null}
          <AvatarFallback className="bg-brand-soft text-lg font-semibold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy || clientAuth.status !== "ready"}
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
          >
            {busy ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Camera data-icon="inline-start" aria-hidden="true" />}
            {busy ? `Uploading ${progress}%` : preview ? "Change photo" : "Upload photo"}
          </Button>
          <p id={hintId} className="text-xs text-muted-foreground">
            JPG, PNG or WebP, up to 5 MB.
          </p>
        </div>
      </div>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      {clientAuth.status === "error" ? <FormAlert tone="error">{clientAuth.message}</FormAlert> : null}
    </div>
  );
}

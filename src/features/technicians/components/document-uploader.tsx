"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useClientAuth } from "@/features/auth/components/firebase-auth-provider";
import { storagePaths } from "@/lib/firestore/collections";
import { deleteFile, safeObjectName, uploadFile } from "@/lib/firebase/upload";

import { ALLOWED_DOCUMENT_TYPES, MAX_APPLICATION_DOCUMENTS, MAX_DOCUMENT_BYTES } from "../schemas";

export function documentName(path: string): string {
  return path.split("/").pop()?.replace(/^\d+-/, "") ?? path;
}

/**
 * Uploads to technicianDocuments/{uid}/ (owner-only per Storage Rules). The
 * paths are submitted with the application and re-verified by the server.
 */
export function DocumentUploader({
  uid,
  value,
  onChange,
  submittedPaths,
}: {
  uid: string;
  value: string[];
  onChange: (paths: string[]) => void;
  /** Paths already attached to a submitted application — never deleted here. */
  submittedPaths: string[];
}) {
  const clientAuth = useClientAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
      return setError("Upload a PDF, JPG, PNG or WebP file.");
    }
    if (file.size > MAX_DOCUMENT_BYTES) return setError("Each document must be smaller than 10 MB.");
    if (value.length >= MAX_APPLICATION_DOCUMENTS) {
      return setError(`You can attach up to ${MAX_APPLICATION_DOCUMENTS} documents.`);
    }
    setProgress(0);
    try {
      const path = await uploadFile(
        `${storagePaths.technicianDocumentPrefix(uid)}${safeObjectName(file)}`,
        file,
        setProgress,
      );
      onChange([...value, path]);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(path: string) {
    onChange(value.filter((p) => p !== path));
    if (!submittedPaths.includes(path)) await deleteFile(path).catch(() => {});
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {value.map((path) => (
            <li key={path} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{documentName(path)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(path)}
                aria-label={`Remove ${documentName(path)}`}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_DOCUMENT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-describedby={hintId}
        disabled={progress !== null || clientAuth.status !== "ready" || value.length >= MAX_APPLICATION_DOCUMENTS}
        onClick={() => inputRef.current?.click()}
      >
        {progress !== null ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Paperclip data-icon="inline-start" aria-hidden="true" />
        )}
        {progress !== null ? `Uploading ${progress}%` : "Attach document"}
      </Button>
      <p id={hintId} className="text-xs text-muted-foreground">
        Optional: NVQ certificates, training records or trade licences. PDF or image, up to 10 MB
        each, maximum {MAX_APPLICATION_DOCUMENTS}. Only Handy Ceylon administrators can view them.
      </p>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

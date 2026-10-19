"use client";

import { Film, ImageIcon, ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useClientAuth } from "@/features/auth/components/firebase-auth-provider";
import { deleteFile, safeObjectName, uploadFile } from "@/lib/firebase/upload";
import { storagePaths } from "@/lib/firestore/collections";

import { formatBytes } from "../format";
import { attachmentKind, validateAttachmentFile, type AttachmentInput } from "../schemas";
import { IMAGE_TYPES, MAX_ATTACHMENTS, MAX_VIDEO_SECONDS, MAX_VIDEOS, VIDEO_TYPES } from "../types";

type Upload = { id: string; name: string; progress: number };

/** Resolves null when the browser can't read the duration; the size limit still applies. */
function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}

/**
 * Uploads to requestMedia/{uid}/{submissionKey}/ — a draft folder only the
 * customer can write (Storage Rules also enforce type and size). The server
 * re-verifies every file when the request is submitted.
 */
export function AttachmentUploader({
  uid,
  submissionKey,
  value,
  onChange,
  onBusyChange,
  invalid,
  describedBy,
}: {
  uid: string;
  submissionKey: string;
  value: AttachmentInput[];
  onChange: (value: AttachmentInput[]) => void;
  onBusyChange: (busy: boolean) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const clientAuth = useClientAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  // Uploads finish one by one; always append to the latest list.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => onBusyChange(uploads.length > 0), [uploads.length, onBusyChange]);

  const previewUrls = useRef(previews);
  useEffect(() => {
    previewUrls.current = previews;
  }, [previews]);
  useEffect(() => () => Object.values(previewUrls.current).forEach((url) => URL.revokeObjectURL(url)), []);

  async function check(file: File, accepted: File[]): Promise<string | null> {
    const problem = validateAttachmentFile(file);
    if (problem) return problem;
    const isVideo = attachmentKind(file.type) === "video";
    const videos =
      latest.current.filter((a) => attachmentKind(a.contentType) === "video").length +
      accepted.filter((f) => attachmentKind(f.type) === "video").length;
    if (isVideo && videos >= MAX_VIDEOS) return `You can attach up to ${MAX_VIDEOS} videos.`;
    if (isVideo) {
      const seconds = await videoDuration(file);
      if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 0.5) {
        return `Keep videos to ${MAX_VIDEO_SECONDS} seconds or less.`;
      }
    }
    return null;
  }

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    setErrors([]);

    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      if (latest.current.length + uploads.length + accepted.length >= MAX_ATTACHMENTS) {
        problems.push(`You can attach up to ${MAX_ATTACHMENTS} files. "${file.name}" was not added.`);
        continue;
      }
      const problem = await check(file, accepted);
      if (problem) problems.push(`"${file.name}": ${problem}`);
      else accepted.push(file);
    }
    setErrors(problems);

    for (const file of accepted) {
      const id = crypto.randomUUID();
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        const path = await uploadFile(
          `${storagePaths.requestDraftPrefix(uid, submissionKey)}${safeObjectName(file)}`,
          file,
          (progress) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))),
        );
        if (attachmentKind(file.type) === "image") {
          setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(file) }));
        }
        const next = [
          ...latest.current,
          { storagePath: path, contentType: file.type, sizeBytes: file.size, name: file.name.slice(-120) },
        ];
        latest.current = next;
        onChange(next);
      } catch {
        setErrors((e) => [...e, `"${file.name}" failed to upload. Check your connection and try again.`]);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
  }

  function remove(attachment: AttachmentInput) {
    const next = latest.current.filter((a) => a.storagePath !== attachment.storagePath);
    latest.current = next;
    onChange(next);
    // Best effort: leftovers in the draft folder are deleted when the request is submitted.
    deleteFile(attachment.storagePath).catch(() => {});
  }

  const full = value.length + uploads.length >= MAX_ATTACHMENTS;

  return (
    <div className="space-y-4">
      {value.length > 0 || uploads.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Attached files">
          {value.map((a) => {
            const isVideo = attachmentKind(a.contentType) === "video";
            const preview = previews[a.storagePath];
            return (
              <li key={a.storagePath} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {preview ? (
                    // Local object URL of the file just uploaded; not optimisable by next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : isVideo ? (
                    <Film className="size-5" aria-hidden="true" />
                  ) : (
                    <ImageIcon className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isVideo ? "Video" : "Photo"} · {formatBytes(a.sizeBytes)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(a)}
                  aria-label={`Remove ${a.name}`}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            );
          })}
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-2.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                <Spinner aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{u.name}</span>
                <span
                  className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`Uploading ${u.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={u.progress}
                >
                  <span className="block h-full bg-primary transition-[width]" style={{ width: `${u.progress}%` }} />
                </span>
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{u.progress}%</span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
        aria-invalid={invalid}
        disabled={full || clientAuth.status !== "ready"}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus data-icon="inline-start" aria-hidden="true" />
        {value.length > 0 ? "Add more photos or videos" : "Add photos or videos"}
      </Button>
      <p id={hintId} className="text-xs text-muted-foreground">
        Up to {MAX_ATTACHMENTS} files: photos (JPG, PNG, WebP, HEIC, max 10 MB) and up to {MAX_VIDEOS} short
        videos (MP4, MOV, WebM, max {MAX_VIDEO_SECONDS} seconds and 50 MB). Only you, Handy Ceylon staff and
        technicians responding to your request can see them.
      </p>
      <div aria-live="polite" className="space-y-2">
        {errors.map((e) => (
          <FormAlert key={e} tone="error">
            {e}
          </FormAlert>
        ))}
      </div>
    </div>
  );
}

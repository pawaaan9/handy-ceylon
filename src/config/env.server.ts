import "server-only";

import { z } from "zod";

/**
 * Privileged server configuration. Never prefix these with NEXT_PUBLIC_ and
 * never import this module from a Client Component (`server-only` enforces it).
 *
 * Service-account credentials are optional: when they are absent the Admin SDK
 * falls back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS,
 * Firebase App Hosting, Cloud Run) or the local emulators.
 */
const serverEnvSchema = z
  .object({
    FIREBASE_ADMIN_PROJECT_ID: z.string().min(1).optional(),
    FIREBASE_ADMIN_CLIENT_EMAIL: z.email().optional(),
    FIREBASE_ADMIN_PRIVATE_KEY: z
      .string()
      .min(1)
      .optional()
      // Hosting dashboards usually store the key with escaped newlines.
      .transform((key) => key?.replace(/\\n/g, "\n")),
    FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  })
  .refine(
    (env) =>
      Boolean(env.FIREBASE_ADMIN_CLIENT_EMAIL) ===
      Boolean(env.FIREBASE_ADMIN_PRIVATE_KEY),
    {
      message:
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY must be set together.",
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    FIREBASE_ADMIN_PROJECT_ID:
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      undefined,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || undefined,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY || undefined,
    FIREBASE_STORAGE_BUCKET:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Firebase Admin configuration is invalid: ${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

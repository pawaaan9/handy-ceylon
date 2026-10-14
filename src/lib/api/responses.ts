import "server-only";

import { z } from "zod";

import { AuthError } from "@/features/auth/server/errors";
import { TransitionError } from "@/features/bookings/state-machine";

/** Maps known domain errors to JSON responses without leaking internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof TransitionError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: "Invalid request.", issues: z.flattenError(error).fieldErrors },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}

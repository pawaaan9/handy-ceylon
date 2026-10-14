import { getUserFromRequest } from "@/features/auth/server/current-user";
import { onboardUser } from "@/features/auth/server/onboard-user";
import { onboardingInputSchema } from "@/features/auth/schemas";
import { errorResponse } from "@/lib/api/responses";

/**
 * POST /api/account/onboard
 * Called once after Firebase sign-up. Assigns `customer` or `technician`;
 * the client must then refresh its ID token (getIdToken(true)) to pick up
 * the new role claim.
 */
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const input = onboardingInputSchema.parse(await request.json());
    await onboardUser(user, input);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/features/auth/constants";

/**
 * Optimistic check only: no cookie → straight to login, saving a render.
 * It never grants access — every protected page and Server Action verifies
 * the session and role on the server (see features/auth/server/dal.ts).
 */
const protectedPrefixes = [
  "/customer",
  "/technician/dashboard",
  "/technician/application",
  "/technician/requests",
  "/technician/jobs",
  "/admin",
  "/verify-email",
  "/complete-profile",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/customer/:path*",
    "/technician/:path*",
    "/admin/:path*",
    "/verify-email",
    "/complete-profile",
  ],
};

import type { TechnicianApplicationStatus } from "@/features/technicians/types";

import type { UserRole } from "./roles";

export const authRoutes = {
  login: "/login",
  signUp: "/signup",
  forgotPassword: "/forgot-password",
  verifyEmail: "/verify-email",
  completeProfile: "/complete-profile",
  authAction: "/auth/action",
} as const;

export const roleHomes = {
  customer: "/customer/dashboard",
  technician: "/technician/dashboard",
  admin: "/admin/dashboard",
} as const satisfies Record<UserRole, string>;

export const technicianRoutes = {
  register: "/technician/register",
  application: "/technician/application",
} as const;

/** Which roles may open each protected area. Pages enforce this on the server. */
export const areaAccess: readonly { prefix: string; roles: readonly UserRole[] }[] = [
  { prefix: "/customer", roles: ["customer"] },
  { prefix: "/technician/dashboard", roles: ["technician"] },
  { prefix: "/admin", roles: ["admin"] },
];

type HomeInput = {
  role: UserRole | null;
  applicationStatus?: TechnicianApplicationStatus | null;
};

/** Where a signed-in user lands by default. */
export function homePathFor({ role, applicationStatus }: HomeInput): string {
  if (!role) return authRoutes.completeProfile;
  if (role === "customer" && applicationStatus && applicationStatus !== "approved") {
    return technicianRoutes.application;
  }
  return roleHomes[role];
}

export function canAccessPath(role: UserRole | null, path: string): boolean {
  const area = areaAccess.find(
    (a) => path === a.prefix || path.startsWith(`${a.prefix}/`),
  );
  if (!area) return true;
  return role !== null && area.roles.includes(role);
}

/**
 * Accepts only same-origin relative paths, so `?next=` can never redirect
 * off-site (open-redirect protection).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\r\n\t]/.test(next)) return null;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/** Honour `next` only when the user's role may open it; otherwise go home. */
export function postLoginPath(user: HomeInput, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  if (safe && user.role && canAccessPath(user.role, safe) && !isAuthPagePath(safe)) {
    return safe;
  }
  return homePathFor(user);
}

export function isAuthPagePath(path: string): boolean {
  return [authRoutes.login, authRoutes.signUp, authRoutes.forgotPassword].some(
    (p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`),
  );
}

import type { UserRole } from "@/features/auth/roles";

export type NavItem = { href: string; label: string };

export const navByRole: Record<UserRole, NavItem[]> = {
  customer: [
    { href: "/customer/dashboard", label: "Dashboard" },
    { href: "/services", label: "Services" },
    { href: "/customer/addresses", label: "Addresses" },
    { href: "/customer/profile", label: "Profile" },
  ],
  technician: [{ href: "/technician/dashboard", label: "Dashboard" }],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/technician-applications", label: "Applications" },
  ],
};

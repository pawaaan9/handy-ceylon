import type { UserRole } from "@/features/auth/roles";

export type NavIcon = "dashboard" | "services" | "addresses" | "profile" | "applications" | "jobs";
export type NavItem = { href: string; label: string; icon: NavIcon };

export const navByRole: Record<UserRole, NavItem[]> = {
  customer: [
    { href: "/customer/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/services", label: "Services", icon: "services" },
    { href: "/customer/addresses", label: "Addresses", icon: "addresses" },
    { href: "/customer/profile", label: "Profile", icon: "profile" },
  ],
  technician: [
    { href: "/technician/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/services", label: "Services", icon: "services" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/admin/technician-applications", label: "Applications", icon: "applications" },
    { href: "/services", label: "Services", icon: "services" },
  ],
};

export const roleLabels: Record<UserRole, string> = {
  customer: "Customer",
  technician: "Technician",
  admin: "Administrator",
};

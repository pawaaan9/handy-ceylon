import type { UserRole } from "@/features/auth/roles";

export type NavIcon =
  | "dashboard"
  | "services"
  | "requests"
  | "addresses"
  | "profile"
  | "applications"
  | "jobs"
  | "technicians"
  | "customers"
  | "payments"
  | "catalogue";
export type NavBadge = "pendingApplications";
/** `section` groups items under a heading; `badge` shows a live count next to the label. */
export type NavItem = { href: string; label: string; icon: NavIcon; section?: string; badge?: NavBadge };

export const navByRole: Record<UserRole, NavItem[]> = {
  customer: [
    { href: "/customer/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/customer/requests", label: "Requests", icon: "requests" },
    { href: "/services", label: "Services", icon: "services" },
    { href: "/customer/addresses", label: "Addresses", icon: "addresses" },
    { href: "/customer/profile", label: "Profile", icon: "profile" },
  ],
  technician: [
    { href: "/technician/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/technician/requests", label: "Job requests", icon: "requests" },
    { href: "/technician/jobs", label: "My jobs", icon: "jobs" },
    { href: "/services", label: "Services", icon: "services" },
  ],
  // Everything an administrator needs, inside the admin panel — no links out to the public site.
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard", section: "Overview" },
    {
      href: "/admin/technician-applications",
      label: "Applications",
      icon: "applications",
      section: "People",
      badge: "pendingApplications",
    },
    { href: "/admin/technicians", label: "Technicians", icon: "technicians", section: "People" },
    { href: "/admin/customers", label: "Customers", icon: "customers", section: "People" },
    { href: "/admin/requests", label: "Service requests", icon: "requests", section: "Operations" },
    { href: "/admin/jobs", label: "Jobs", icon: "jobs", section: "Operations" },
    { href: "/admin/payments", label: "Payments", icon: "payments", section: "Operations" },
    { href: "/admin/catalogue", label: "Service catalogue", icon: "catalogue", section: "Catalogue" },
  ],
};

export const roleLabels: Record<UserRole, string> = {
  customer: "Customer",
  technician: "Technician",
  admin: "Administrator",
};

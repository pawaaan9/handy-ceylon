"use client";

import {
  ClipboardCheck,
  ClipboardList,
  Hammer,
  LayoutDashboard,
  MapPin,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import type { NavIcon, NavItem } from "./nav-config";

const icons: Record<NavIcon, (props: { className?: string }) => React.ReactElement> = {
  dashboard: (p) => <LayoutDashboard {...p} aria-hidden="true" />,
  services: (p) => <Wrench {...p} aria-hidden="true" />,
  requests: (p) => <ClipboardList {...p} aria-hidden="true" />,
  addresses: (p) => <MapPin {...p} aria-hidden="true" />,
  profile: (p) => <UserRound {...p} aria-hidden="true" />,
  applications: (p) => <ClipboardCheck {...p} aria-hidden="true" />,
  jobs: (p) => <Hammer {...p} aria-hidden="true" />,
};

/** Vertical navigation; `tone="dark"` for the navy sidebar, `light` for the mobile sheet. */
export function AppNav({
  items,
  tone,
  onNavigate,
}: {
  items: NavItem[];
  tone: "dark" | "light";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  return (
    <nav aria-label="Account">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  tone === "dark"
                    ? active
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/5 hover:text-white"
                    : active
                      ? "bg-brand-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <span aria-hidden="true" className="absolute top-2 bottom-2 -left-0.5 w-1 rounded-full bg-urgent" />
                ) : null}
                {icons[item.icon]({ className: "size-[1.15rem]" })}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

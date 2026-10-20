"use client";

import {
  ClipboardCheck,
  ClipboardList,
  Hammer,
  HardHat,
  Layers,
  LayoutDashboard,
  MapPin,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import type { NavBadge, NavIcon, NavItem } from "./nav-config";

const icons: Record<NavIcon, (props: { className?: string }) => React.ReactElement> = {
  dashboard: (p) => <LayoutDashboard {...p} aria-hidden="true" />,
  services: (p) => <Wrench {...p} aria-hidden="true" />,
  requests: (p) => <ClipboardList {...p} aria-hidden="true" />,
  addresses: (p) => <MapPin {...p} aria-hidden="true" />,
  profile: (p) => <UserRound {...p} aria-hidden="true" />,
  applications: (p) => <ClipboardCheck {...p} aria-hidden="true" />,
  jobs: (p) => <Hammer {...p} aria-hidden="true" />,
  technicians: (p) => <HardHat {...p} aria-hidden="true" />,
  customers: (p) => <Users {...p} aria-hidden="true" />,
  payments: (p) => <Wallet {...p} aria-hidden="true" />,
  catalogue: (p) => <Layers {...p} aria-hidden="true" />,
};

/** Vertical navigation, grouped by section; `tone="dark"` for the navy sidebar, `light` for the mobile sheet. */
export function AppNav({
  items,
  tone,
  badges,
  onNavigate,
}: {
  items: NavItem[];
  tone: "dark" | "light";
  badges?: Partial<Record<NavBadge, number>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  const groups = items.reduce<{ section: string | undefined; items: NavItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);

  return (
    <nav aria-label="Account" className="space-y-5">
      {groups.map((group, g) => (
        <div key={group.section ?? g}>
          {group.section ? (
            <p
              className={cn(
                "mb-1.5 px-3.5 text-[11px] font-semibold tracking-wider uppercase",
                tone === "dark" ? "text-white/40" : "text-muted-foreground",
              )}
            >
              {group.section}
            </p>
          ) : null}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = item.badge ? badges?.[item.badge] : undefined;
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
                    <span className="flex-1">{item.label}</span>
                    {count ? (
                      <span className="rounded-full bg-urgent px-2 py-0.5 text-xs font-semibold text-urgent-foreground tabular-nums">
                        {count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

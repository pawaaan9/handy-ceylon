import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      {/* Roof line over an "H" — a home and a handy pair of uprights. */}
      <path
        d="M7.5 14.5 16 8l8.5 6.5"
        fill="none"
        stroke="white"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 15v9M20.5 15v9M11.5 19.5h9"
        fill="none"
        stroke="white"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  inverted = false,
  href = "/",
}: {
  className?: string;
  inverted?: boolean;
  /** Signed-in areas point the logo at the user's own dashboard. */
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-md", className)}
      aria-label={`${siteConfig.name} home`}
    >
      <LogoMark />
      <span
        className={cn(
          "font-heading text-[1.05rem] font-bold tracking-tight",
          inverted ? "text-navy-foreground" : "text-foreground",
        )}
      >
        Handy<span className={inverted ? "text-[oklch(0.82_0.11_180)]" : "text-primary"}>Ceylon</span>
      </span>
    </Link>
  );
}

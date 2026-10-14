import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { HomeScene } from "@/components/illustrations/home-scene";
import { LinePattern } from "@/components/illustrations/line-pattern";
import { ToolsScene } from "@/components/illustrations/tools-scene";
import { SecureScene } from "@/components/illustrations/secure-scene";
import { cn } from "@/lib/utils";

const scenes = { home: HomeScene, tools: ToolsScene, secure: SecureScene } as const;

/** Flat colour banner with an illustration — the top of every dashboard. */
export function WelcomeBanner({
  eyebrow,
  title,
  description,
  actions,
  scene = "home",
  tone = "primary",
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  scene?: keyof typeof scenes;
  tone?: "primary" | "navy";
}) {
  const Scene = scenes[scene];
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl text-white",
        tone === "primary" ? "bg-primary" : "bg-navy",
      )}
    >
      <LinePattern className="text-white/[0.07]" />
      <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] lg:p-10">
        <div>
          {eyebrow ? <p className="text-sm font-semibold text-white/75">{eyebrow}</p> : null}
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-xl text-white/80">{description}</p> : null}
          {actions ? <div className="mt-6 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {/* On teal, frame the scene on sand so its teal details stay visible. */}
        <div className={cn("hidden md:block", tone === "primary" && "rounded-2xl bg-sand px-5 pt-4")}>
          <Scene className="h-44 w-auto lg:h-48" />
        </div>
      </div>
    </section>
  );
}

const tileTones = {
  primary: "bg-brand-soft text-primary",
  urgent: "bg-urgent-soft text-urgent",
  navy: "bg-navy text-navy-foreground",
  sand: "bg-sand text-clay",
  leaf: "bg-leaf/15 text-leaf",
} as const;
export type TileTone = keyof typeof tileTones;

/** Clickable tile with a coloured icon square. */
export function ActionTile({
  href,
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  href: string;
  icon: LucideIcon;
  tone: TileTone;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between">
        <span className={cn("flex size-11 items-center justify-center rounded-xl", tileTones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <h2 className="mt-4 font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {children}
    </Link>
  );
}

/** Small statistic with a coloured marker. */
export function StatTile({ label, value, tone }: { label: string; value: React.ReactNode; tone: TileTone }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", tileTones[tone].split(" ")[0])} aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-heading text-3xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/** Flat segmented progress meter (no gradients). */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div>
      <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full", i < value ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {value} of {max} complete
      </p>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

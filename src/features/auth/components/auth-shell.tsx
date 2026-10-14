import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import { HomeScene } from "@/components/illustrations/home-scene";
import { LinePattern } from "@/components/illustrations/line-pattern";
import { SecureScene } from "@/components/illustrations/secure-scene";
import { ToolsScene } from "@/components/illustrations/tools-scene";
import { Logo } from "@/components/layout/logo";
import { routes, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const art = {
  home: {
    Scene: HomeScene,
    panel: "bg-navy",
    eyebrow: "Home services across Sri Lanka",
    title: "Reliable help for every home, from Jaffna to Galle.",
    points: ["Verified technicians only", "Approve every quotation before work starts", "Clear prices in LKR"],
  },
  tools: {
    Scene: ToolsScene,
    panel: "bg-primary",
    eyebrow: "For skilled professionals",
    title: "Grow your trade with customers who are ready to book.",
    points: ["Requests from the districts you choose", "Set your own inspection fees", "Build a reputation with real reviews"],
  },
  secure: {
    Scene: SecureScene,
    panel: "bg-navy",
    eyebrow: "Your account, protected",
    title: "Security checks keep your bookings and details safe.",
    points: ["Verified email and mobile numbers", "Passwords are never stored by Handy Ceylon", "Exact addresses shared only after you book"],
  },
} as const;

export type AuthArt = keyof typeof art;

/**
 * Split-screen layout for auth pages: the form on the left, a flat
 * illustration panel on the right (stacked as a banner on small screens).
 */
export function AuthShell({
  art: variant,
  title,
  description,
  children,
  footer,
}: {
  art: AuthArt;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { Scene, panel, eyebrow, title: asideTitle, points } = art[variant];
  return (
    <div className="grid min-h-dvh flex-1 bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between px-5 sm:px-10">
          <Logo />
          <Link
            href={routes.home}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to home</span>
            <span className="sm:hidden">Home</span>
          </Link>
        </header>

        <main id="main" className="flex flex-1 justify-center px-5 pt-4 pb-12 sm:px-10 lg:items-center lg:py-12">
          <div className="w-full max-w-md">
            <div className={cn("relative mb-8 overflow-hidden rounded-2xl lg:hidden", panel)}>
              <LinePattern className="text-white/[0.06]" />
              <Scene className="relative mx-auto h-36 w-auto py-2" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground sm:text-[2rem]">{title}</h1>
            {description ? <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </main>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-6 text-xs text-muted-foreground sm:px-10">
          <span>© {siteConfig.name}</span>
          <Link href={routes.terms} className="hover:text-foreground">
            Terms
          </Link>
          <Link href={routes.privacy} className="hover:text-foreground">
            Privacy
          </Link>
        </footer>
      </div>

      <aside className={cn("relative hidden overflow-hidden text-navy-foreground lg:flex", panel)}>
        <LinePattern className="text-white/[0.06]" />
        <div className="relative m-6 flex flex-1 flex-col justify-between rounded-[2rem] border border-white/10 p-10 xl:p-14">
          <div>
            <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">{eyebrow}</p>
            <p className="mt-3 max-w-md font-heading text-3xl leading-tight font-bold xl:text-4xl">{asideTitle}</p>
          </div>
          <Scene className="mx-auto my-8 w-full max-w-lg" />
          <ul className="grid gap-3 text-sm xl:grid-cols-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 rounded-xl bg-white/[0.07] p-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-navy">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function AuthShellSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5" role="status" aria-label="Loading">
      <div className="w-full max-w-md space-y-5">
        <div className="h-9 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-muted" />
        <div className="h-11 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

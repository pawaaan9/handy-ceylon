import { ArrowLeft, BadgeCheck, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { photos, type PhotoKey } from "@/assets/photos";
import { Logo } from "@/components/layout/logo";
import { routes, siteConfig } from "@/config/site";

const panels = {
  welcome: {
    photo: "technicianPortrait",
    position: "object-[25%_30%]",
    title: "Trusted professionals for every home in Sri Lanka.",
    points: ["Verified technicians only", "Approve every quotation first", "Clear prices in LKR"],
  },
  join: {
    photo: "electricianAtWork",
    position: "object-[55%_35%]",
    title: "Book skilled help in minutes, not days.",
    points: ["Plumbing, electrical, AC and more", "Compare quotations side by side", "Track every job in one place"],
  },
  technician: {
    photo: "technicianToolBelt",
    position: "object-[35%_50%]",
    title: "Grow your trade with customers ready to book.",
    points: ["Requests from districts you choose", "Set your own inspection fees", "Build a reputation with reviews"],
  },
  secure: {
    photo: "electricalPanel",
    position: "object-center",
    title: "Your account and bookings, protected.",
    points: ["Verified email and mobile", "Passwords never stored by us", "Addresses shared only after booking"],
  },
} as const satisfies Record<string, { photo: PhotoKey; position: string; title: string; points: readonly string[] }>;

export type AuthArt = keyof typeof panels;

/**
 * Split-screen auth layout. On large screens the page is exactly one viewport
 * tall: the photo panel sits on the left and fills the height, the form
 * column on the right scrolls on its own. Below `lg` only the form shows.
 */
export function AuthShell({
  art,
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
  const panel = panels[art];
  const photo = photos[panel.photo];
  return (
    <div className="grid min-h-dvh flex-1 bg-background lg:h-dvh lg:flex-none lg:grid-cols-2 lg:grid-rows-1 lg:overflow-hidden">
      <div className="relative flex min-h-dvh min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto">
        <header className="flex h-16 shrink-0 items-center justify-between px-5 sm:px-10 lg:px-14">
          <Logo />
          <Link
            href={routes.home}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to home</span>
            <span className="sm:hidden">Home</span>
          </Link>
        </header>

        <main id="main" className="flex flex-1 justify-center px-5 py-10 sm:px-10 lg:items-center lg:px-14">
          <div className="w-full max-w-[26rem]">
            <h1 className="text-[2rem] leading-tight font-bold text-foreground">{title}</h1>
            {description ? <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 border-t pt-6 text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </main>

        <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-6 text-xs text-muted-foreground sm:px-10 lg:px-14">
          <span>© {siteConfig.name}</span>
          <Link href={routes.terms} className="hover:text-foreground">
            Terms
          </Link>
          <Link href={routes.privacy} className="hover:text-foreground">
            Privacy
          </Link>
        </footer>
      </div>

      <aside className="relative hidden h-full p-3 lg:order-first lg:block">
        <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-navy">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            sizes="50vw"
            placeholder="blur"
            className={`object-cover ${panel.position}`}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-navy/25" />

          <div className="absolute top-6 left-6 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy">
            <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
            Verified professionals
          </div>

          <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-navy/90 p-7 text-navy-foreground backdrop-blur-sm xl:p-8">
            <p className="max-w-md text-2xl leading-snug font-semibold xl:text-[1.7rem]">{panel.title}</p>
            <ul className="mt-5 grid gap-2.5 text-sm xl:grid-cols-3 xl:gap-4">
              {panel.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-white/85">
                  <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3 text-white" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
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

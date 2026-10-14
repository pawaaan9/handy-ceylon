"use client";

import { ArrowRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { routes } from "@/config/site";
import { CategoryMedia } from "@/features/catalogue/components/category-media";
import type { CategoryView } from "@/features/catalogue/types";
import { cn } from "@/lib/utils";

export type HeaderLink = { href: string; label: string };

const itemClass =
  "relative z-10 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-white/70 transition-colors hover:text-white focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none";

/**
 * Desktop navigation on the navy capsule: items sit in a recessed track and a
 * highlight glides to whichever item is hovered or focused. Services opens a
 * dropdown built from the active catalogue.
 */
export function ServicesMenu({
  categories,
  links,
}: {
  categories: CategoryView[];
  links: readonly HeaderLink[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState<{ left: number; width: number } | null>(
    null,
  );

  function moveTo(target: HTMLElement) {
    const track = trackRef.current;
    if (!track) return;
    const a = target.getBoundingClientRect();
    const b = track.getBoundingClientRect();
    setGlow({ left: a.left - b.left, width: a.width });
  }
  const hover = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => moveTo(e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => moveTo(e.currentTarget),
  };

  return (
    <div
      ref={trackRef}
      className="relative rounded-full bg-white/[0.06] p-1"
      onMouseLeave={() => setGlow(null)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1 bottom-1 rounded-full bg-white/12 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          glow ? "opacity-100" : "opacity-0",
        )}
        style={glow ? { left: glow.left, width: glow.width } : undefined}
      />
      <NavigationMenu viewport={false} aria-label="Main">
        <NavigationMenuList className="gap-0.5">
          <NavigationMenuItem>
            <NavigationMenuTrigger
              {...hover}
              className={cn(
                itemClass,
                "bg-transparent hover:bg-transparent focus:bg-transparent data-open:bg-transparent data-open:text-white data-open:hover:bg-transparent",
              )}
            >
              Services
            </NavigationMenuTrigger>
            <NavigationMenuContent className="text-foreground group-data-[viewport=false]/navigation-menu:mt-4 group-data-[viewport=false]/navigation-menu:rounded-2xl group-data-[viewport=false]/navigation-menu:shadow-[0_24px_60px_-24px_rgb(15_23_42/0.35)]">
              <div className="grid w-[46rem] grid-cols-[1fr_15rem] gap-2 p-2">
                {categories.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-1">
                    {categories.slice(0, 8).map((category, index) => (
                      <li key={category.id}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={`/services/${category.id}`}
                            className="flex items-start gap-3 rounded-xl p-3"
                          >
                            <CategoryMedia
                              category={category}
                              index={index}
                              className="size-10"
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold text-foreground">
                                {category.name}
                              </span>
                              <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {category.description}
                              </span>
                            </span>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center rounded-xl bg-muted/50 p-6 text-sm text-muted-foreground">
                    Our service catalogue is being updated.
                  </p>
                )}
                <div className="flex flex-col justify-between rounded-xl bg-navy p-5 text-navy-foreground">
                  <div>
                    <Search className="size-5 text-urgent" aria-hidden="true" />
                    <p className="mt-3 font-semibold">
                      Not sure what you need?
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      Search every service, or describe the job and compare
                      quotations.
                    </p>
                  </div>
                  <div className="mt-5 space-y-2">
                    <NavigationMenuLink asChild>
                      <Link
                        href={routes.services}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-white/90"
                      >
                        All services{" "}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </NavigationMenuLink>
                    <NavigationMenuLink asChild>
                      <Link
                        href={routes.getAQuote}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
                      >
                        <FileText className="size-4" aria-hidden="true" /> Get a
                        Quote
                      </Link>
                    </NavigationMenuLink>
                  </div>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          {links.map((link) => (
            <NavigationMenuItem key={link.href}>
              <NavigationMenuLink asChild>
                <Link
                  href={link.href}
                  {...hover}
                  className={cn(
                    itemClass,
                    "p-0 px-4 hover:bg-transparent focus:bg-transparent",
                  )}
                >
                  {link.label}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

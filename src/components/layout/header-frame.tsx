"use client";

import { Menu, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LinePattern } from "@/components/illustrations/line-pattern";
import { cn } from "@/lib/utils";

import { Logo } from "./logo";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * Floating navy capsule. It sits just below the top of the page and, once the
 * page scrolls, narrows and tightens so content shows around it.
 */
export function HeaderFrame({
  nav,
  actions,
  mobileActions,
  mobileMenu,
}: {
  nav: React.ReactNode;
  actions: React.ReactNode;
  mobileActions: React.ReactNode;
  mobileMenu: React.ReactNode;
}) {
  const scrolled = useSyncExternalStore(subscribe, () => window.scrollY > 24, () => false);
  const [open, setOpen] = useState(false);

  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div
        className={cn(
          "pointer-events-auto mx-auto transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          scrolled ? "max-w-6xl" : "max-w-7xl",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-navy pr-2 pl-4 text-navy-foreground transition-[height,box-shadow] duration-300",
            scrolled
              ? "h-14 shadow-[0_18px_40px_-16px_rgb(15_23_42/0.55)]"
              : "h-16 shadow-[0_12px_32px_-20px_rgb(15_23_42/0.5)]",
          )}
        >
          <Logo inverted />
          <div className="hidden flex-1 justify-center lg:flex">{nav}</div>
          <div className="flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 sm:flex">{actions}</div>
            <div className="flex items-center gap-1.5 sm:hidden">{mobileActions}</div>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-xl text-white hover:bg-white/10 hover:text-white lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                className="w-full gap-0 overflow-y-auto border-none bg-navy text-navy-foreground sm:max-w-sm"
              >
                <LinePattern className="text-white/[0.04]" />
                <div className="relative flex h-16 shrink-0 items-center justify-between px-5">
                  <SheetTitle asChild>
                    <div>
                      <Logo inverted />
                    </div>
                  </SheetTitle>
                  <SheetDescription className="sr-only">Site navigation</SheetDescription>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className="rounded-xl text-white hover:bg-white/10 hover:text-white"
                      aria-label="Close menu"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </SheetClose>
                </div>
                {/* Close the sheet when any link inside it is followed. */}
                <div
                  className="relative flex flex-1 flex-col"
                  onClickCapture={(e) => {
                    if ((e.target as HTMLElement).closest("a")) setOpen(false);
                  }}
                >
                  {mobileMenu}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

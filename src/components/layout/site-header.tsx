"use client";

import { Menu, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { routes } from "@/config/site";

import { Container } from "./container";
import { Logo } from "./logo";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/#booking-options", label: "Booking options" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-handy-ceylon", label: "Why Handy Ceylon" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container className="flex h-[4.5rem] items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="lg" className="hidden sm:inline-flex">
            <Link href={routes.login}>Log in</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="hidden md:inline-flex">
            <Link href={routes.signUp}>Sign up</Link>
          </Button>
          <Button asChild variant="urgent" size="lg" className="hidden sm:inline-flex">
            <Link href={routes.getHelpNow}>
              <Zap data-icon="inline-start" aria-hidden="true" />
              Get Help Now
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Site navigation and booking actions
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile" className="px-4">
                <ul className="flex flex-col">
                  {navLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-2 py-3 text-base font-medium text-foreground hover:bg-muted"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t p-4">
                <Button asChild variant="urgent" size="xl">
                  <Link href={routes.getHelpNow} onClick={() => setOpen(false)}>
                    Get Help Now
                  </Link>
                </Button>
                <Button asChild size="xl">
                  <Link href={routes.getAQuote} onClick={() => setOpen(false)}>
                    Get a Quote
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="xl">
                  <Link href={routes.login} onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}

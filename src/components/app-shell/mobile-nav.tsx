"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { AppNav } from "./app-nav";
import type { NavBadge, NavItem } from "./nav-config";

export function MobileNav({ items, badges }: { items: NavItem[]; badges?: Partial<Record<NavBadge, number>> }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-lg" className="lg:hidden" aria-label="Open menu">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Account navigation</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-3 pb-6">
          <AppNav items={items} tone="light" badges={badges} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

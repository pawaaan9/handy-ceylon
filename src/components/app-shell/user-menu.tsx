"use client";

import { ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/auth/components/sign-out-button";
import { initials } from "@/lib/format";

import type { NavItem } from "./nav-config";

export function UserMenu({
  name,
  contact,
  photoURL,
  roleLabel,
  items,
}: {
  name: string;
  /** Email, or mobile number for mobile-only accounts. */
  contact: string;
  photoURL: string | null;
  roleLabel: string;
  items: NavItem[];
}) {
  const { signOut, pending } = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" className="h-10 gap-2 px-1.5" aria-label="Account menu">
          <Avatar className="size-8">
            {photoURL ? <AvatarImage src={photoURL} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">
              {initials(name || contact)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name || contact}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{name || "Your account"}</p>
          <p className="truncate text-xs text-muted-foreground">{contact}</p>
          <p className="mt-1 text-xs font-medium text-primary">{roleLabel}</p>
        </DropdownMenuLabel>
        {items.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {items.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={pending}>
          <LogOut aria-hidden="true" />
          {pending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

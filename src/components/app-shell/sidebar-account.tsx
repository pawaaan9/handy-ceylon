"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogoutDialog } from "@/features/auth/components/logout-dialog";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SidebarAccountInfo = {
  name: string;
  /** Email, or mobile number for mobile-only accounts. */
  contact: string;
  photoURL: string | null;
  roleLabel: string;
};

/** Who is signed in, with a Log out button — pinned to the bottom of the menu. */
export function SidebarAccount({ account, tone }: { account: SidebarAccountInfo; tone: "dark" | "light" }) {
  const [confirming, setConfirming] = useState(false);
  const dark = tone === "dark";
  return (
    <div className={cn("space-y-3 border-t p-3", dark ? "border-white/10" : "border-border")}>
      <div className="flex items-center gap-3 px-1">
        <Avatar className="size-9">
          {account.photoURL ? <AvatarImage src={account.photoURL} alt="" className="object-cover" /> : null}
          <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">
            {initials(account.name || account.contact)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", dark ? "text-white" : "text-foreground")}>
            {account.name || "Your account"}
          </p>
          <p className={cn("truncate text-xs", dark ? "text-white/60" : "text-muted-foreground")}>{account.contact}</p>
          <p className="text-[11px] font-semibold tracking-wide text-urgent uppercase">{account.roleLabel}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={cn("w-full", dark && "border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white")}
        onClick={() => setConfirming(true)}
      >
        <LogOut data-icon="inline-start" aria-hidden="true" />
        Log out
      </Button>
      <LogoutDialog open={confirming} onOpenChange={setConfirming} />
    </div>
  );
}

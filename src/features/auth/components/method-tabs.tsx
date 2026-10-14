"use client";

import { Mail, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

export type AuthMethod = "email" | "mobile";

const methods = [
  { id: "email", label: "Email", icon: Mail },
  { id: "mobile", label: "Mobile number", icon: Smartphone },
] as const;

/** Segmented control to switch between email and mobile sign-in. */
export function MethodTabs({ value, onChange }: { value: AuthMethod; onChange: (m: AuthMethod) => void }) {
  return (
    <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {methods.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`method-${id}`}
          aria-selected={value === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

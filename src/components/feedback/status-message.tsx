import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusMessageProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "neutral" | "error";
  children?: React.ReactNode;
  className?: string;
};

/** Shared empty / error / unavailable state. */
export function StatusMessage({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  children,
  className,
}: StatusMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "error"
            ? "bg-destructive/10 text-destructive"
            : "bg-brand-soft text-primary",
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p>
      {children ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}

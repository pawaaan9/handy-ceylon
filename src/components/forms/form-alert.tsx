import { CircleAlert, CircleCheck, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const tones = {
  error: { icon: CircleAlert, className: "border-destructive/30 bg-destructive/5 text-destructive" },
  success: { icon: CircleCheck, className: "border-success/30 bg-success/5 text-success" },
  info: { icon: Info, className: "border-primary/25 bg-brand-soft text-foreground" },
} as const;

export function FormAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-sm", toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "text-foreground/80")}>{children}</div> : null}
      </div>
    </div>
  );
}

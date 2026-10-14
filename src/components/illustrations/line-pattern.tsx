import { useId } from "react";

import { cn } from "@/lib/utils";

/** Subtle flat background pattern (thin diagonal lines). Not a gradient. */
export function LinePattern({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", className)}>
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="28" strokeWidth="1.5" className="stroke-current" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

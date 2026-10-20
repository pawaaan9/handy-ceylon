import { Inbox } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Filter chips that link to `?{param}=value` on the same page. */
export function FilterTabs({
  label,
  basePath,
  param = "status",
  current,
  options,
}: {
  label: string;
  basePath: string;
  param?: string;
  current: string;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.value === "all" ? basePath : `${basePath}?${param}=${o.value}`}
          aria-current={o.value === current ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            o.value === current
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="ml-1.5 tabular-nums opacity-75">{o.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export type AdminColumn = { label: string; className?: string };
export type AdminRow = { key: string; href?: string; cells: React.ReactNode[] };

/**
 * Scrollable table for admin lists. Rows with `href` get a link on their
 * first cell (keyboard- and screen-reader-friendly), and the whole row highlights.
 */
export function AdminTable({
  caption,
  columns,
  rows,
  empty,
}: {
  caption: string;
  columns: AdminColumn[];
  rows: AdminRow[];
  empty: { title: string; description: string };
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary">
          <Inbox className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-4 font-semibold text-foreground">{empty.title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{empty.description}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className={cn("px-4 py-3 font-medium", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.key} className={cn("align-top", row.href && "transition-colors hover:bg-muted/40")}>
              {row.cells.map((cell, i) => (
                <td key={i} className={cn("px-4 py-3", columns[i]?.className)}>
                  {i === 0 && row.href ? (
                    <Link href={row.href} className="font-medium text-foreground hover:text-primary hover:underline">
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pillTones = {
  green: "bg-success/10 text-success",
  blue: "bg-brand-soft text-primary",
  orange: "bg-urgent-soft text-urgent",
  grey: "bg-muted text-muted-foreground",
  red: "bg-destructive/10 text-destructive",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof pillTones; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", pillTones[tone])}>
      {children}
    </span>
  );
}

/** Two-line cell: a main value with muted detail below. */
export function Stack({ main, sub }: { main: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-foreground">{main}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

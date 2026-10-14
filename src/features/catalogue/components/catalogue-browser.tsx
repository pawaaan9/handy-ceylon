"use client";

import { ArrowRight, Search, SearchX, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { searchCatalogue } from "../search";
import type { Catalogue } from "../types";
import { CategoryMedia } from "./category-media";

/**
 * Instant search and category filter over the (cached, active-only)
 * catalogue. State is mirrored to ?q= and ?category= so results are shareable.
 */
export function CatalogueBrowser({ catalogue }: { catalogue: Catalogue }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const searchId = useId();
  const initialCategory = params.get("category");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<string | null>(
    catalogue.categories.some((c) => c.id === initialCategory) ? initialCategory : null,
  );
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => searchCatalogue(catalogue, deferredQuery, category),
    [catalogue, deferredQuery, category],
  );
  const serviceCount = results.reduce((n, r) => n + r.services.length, 0);

  useEffect(() => {
    const next = new URLSearchParams();
    if (deferredQuery.trim()) next.set("q", deferredQuery.trim());
    if (category) next.set("category", category);
    const qs = next.toString();
    if (qs === window.location.search.replace(/^\?/, "")) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [deferredQuery, category, pathname, router]);

  const clear = () => {
    setQuery("");
    setCategory(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative max-w-xl">
          <label htmlFor={searchId} className="sr-only">
            Search services
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, e.g. leaking tap, AC service, sofa cleaning"
            className="h-11 pr-10 pl-10 text-base [&::-webkit-search-cancel-button]:appearance-none"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div role="group" aria-label="Filter by category" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ id: null, name: "All services" }, ...catalogue.categories].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {results.length === 0
          ? "No matching services"
          : `${serviceCount} service${serviceCount === 1 ? "" : "s"} in ${results.length} categor${results.length === 1 ? "y" : "ies"}`}
      </p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">No services match “{query}”</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different word, or browse all categories.</p>
          <Button variant="outline" size="lg" className="mt-5" onClick={clear}>
            Clear search and filters
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {results.map(({ category: c, services }) => (
            <li key={c.id} className="rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <CategoryMedia category={c} index={catalogue.categories.findIndex((x) => x.id === c.id)} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    <Link href={`/services/${c.id}`} className="hover:text-primary">
                      {c.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
                </div>
                <Link
                  href={`/services/${c.id}`}
                  className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
                  aria-label={`View all ${c.name} services`}
                >
                  View all <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              {services.length > 0 ? (
                <ul className="mt-4 grid gap-x-6 gap-y-2 border-t pt-4 sm:grid-cols-2">
                  {services.map((s) => (
                    <li key={s.id} className="text-sm">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="block text-muted-foreground">{s.description}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

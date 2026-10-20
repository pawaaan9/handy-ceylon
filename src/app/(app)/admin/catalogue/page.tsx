import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, PageSkeleton, Panel } from "@/components/app-shell/page-header";
import { FormAlert } from "@/components/forms/form-alert";
import { RefreshCatalogueButton } from "@/features/admin/components/refresh-catalogue-button";
import { Pill } from "@/features/admin/components/admin-ui";
import { loadFullCatalogue, type AdminCategory } from "@/features/admin/server/queries";
import { requireRole } from "@/features/auth/server/dal";

export const metadata: Metadata = { title: "Service catalogue" };

export default function AdminCataloguePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole(["admin"], { from: "/admin/catalogue" });
  let categories: AdminCategory[] | null;
  try {
    categories = await loadFullCatalogue();
  } catch (error) {
    console.error("[admin] catalogue load failed", error);
    categories = null;
  }
  const activeServices = categories?.reduce((n, c) => n + c.services.filter((s) => s.active).length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service catalogue"
        description="All categories and services in Firestore, including inactive ones customers can't see."
      />
      <Panel>
        <p className="text-sm text-muted-foreground">
          {categories
            ? `${categories.filter((c) => c.active).length} of ${categories.length} categories and ${activeServices} services are live. `
            : ""}
          Public pages cache the catalogue for up to 15 minutes — refresh after changing it. To add or edit entries, update
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">scripts/seed-catalogue.mjs</code>
          and run <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed:catalogue</code>.
        </p>
        <div className="mt-4">
          <RefreshCatalogueButton />
        </div>
      </Panel>

      {categories === null ? (
        <FormAlert tone="error">The catalogue couldn&apos;t be read from Firestore. Check the database exists and try again.</FormAlert>
      ) : categories.length === 0 ? (
        <FormAlert tone="info" title="The catalogue is empty">
          Seed it with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed:catalogue</code>, then refresh.
        </FormAlert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((c) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 id={`cat-${c.id}`} className="font-semibold text-foreground">
                    {c.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">{c.id}</p>
                </div>
                <Pill tone={c.active ? "green" : "grey"}>{c.active ? "Live" : "Hidden"}</Pill>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
              {c.subcategories.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Subcategories:{" "}
                  {c.subcategories.map((s, i) => (
                    <span key={s.id} className={s.active ? "" : "line-through"}>
                      {s.name}
                      {i < c.subcategories.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              ) : null}
              <ul className="mt-4 divide-y rounded-lg border">
                {c.services.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-muted-foreground">No services yet.</li>
                ) : (
                  c.services.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">{s.description}</span>
                      </span>
                      <Pill tone={s.active && c.active ? "green" : "grey"}>{s.active && c.active ? "Live" : "Hidden"}</Pill>
                    </li>
                  ))
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

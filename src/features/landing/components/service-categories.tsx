import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/layout/section-heading";
import { routes } from "@/config/site";
import { CategoryMedia } from "@/features/catalogue/components/category-media";
import { getCatalogue } from "@/features/catalogue/server/queries";

/**
 * Reads the cached Firestore catalogue. While Firestore is healthy the grid is
 * part of the static page; if it isn't, the grid streams in per request.
 */
export function ServiceCategories() {
  return (
    <section id="services" aria-labelledby="services-title" className="py-20 sm:py-24">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="services-title"
            eyebrow="Services"
            title="Skilled help for every corner of your home"
            description="From a dripping tap to a full repaint, request the service you need and we will connect you with qualified technicians in your area."
          />
          <Link
            href={routes.services}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Browse all services <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoryGrid />
        </Suspense>
      </Container>
    </section>
  );
}

async function CategoryGrid() {
  const result = await getCatalogue();
  const categories = result.status === "ok" ? result.catalogue.categories.slice(0, 8) : [];
  if (categories.length === 0) {
    return (
      <p className="mt-12 rounded-xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
        Our service catalogue is being updated. Please check back shortly.
      </p>
    );
  }
  return (
    <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category, index) => (
        <li key={category.id} className="bg-card">
          <Link
            href={`/services/${category.id}`}
            className="block h-full p-6 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          >
            <CategoryMedia category={category} index={index} className="size-10" />
            <h3 className="mt-4 text-base font-semibold text-foreground">{category.name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CategoryGridSkeleton() {
  return (
    <div role="status" aria-label="Loading services" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

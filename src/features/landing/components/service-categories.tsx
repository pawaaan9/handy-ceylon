import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
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
    <section id="services" aria-labelledby="services-title" className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            id="services-title"
            eyebrow="Services"
            title="Skilled help for every corner of your home"
            description="From a dripping tap to a full repaint, request the service you need and we will connect you with qualified technicians in your area."
          />
          <Button asChild variant="outline" size="lg" className="shrink-0">
            <Link href={routes.services}>
              Browse all services
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
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
      <p className="mt-12 rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
        Our service catalogue is being updated. Please check back shortly.
      </p>
    );
  }
  return (
    <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category, index) => (
        <li key={category.id}>
          <Link
            href={`/services/${category.id}`}
            className="group flex h-full flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <CategoryMedia category={category} index={index} />
            <h3 className="mt-5 text-base font-semibold text-foreground">{category.name}</h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Explore
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
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
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

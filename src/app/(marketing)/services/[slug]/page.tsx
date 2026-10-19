import { ArrowLeft, FileText, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/site";
import { CategoryMedia } from "@/features/catalogue/components/category-media";
import { getCatalogue } from "@/features/catalogue/server/queries";
import type { ServiceView } from "@/features/catalogue/types";

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCatalogue();
  const category =
    result.status === "ok"
      ? result.catalogue.categories.find((c) => c.id === slug)
      : undefined;
  return category
    ? { title: `${category.name} services`, description: category.description }
    : { title: "Service" };
}

export default function CategoryPage(props: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}

async function CategoryContent({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const result = await getCatalogue();
  if (result.status === "unavailable")
    throw new Error("Service catalogue unavailable");
  // Inactive or unknown categories are not in the active catalogue → 404.
  const category = result.catalogue.categories.find((c) => c.id === slug);
  if (!category) notFound();

  const services = result.catalogue.services.filter(
    (s) => s.categoryId === category.id,
  );
  const groups: { id: string; name: string; services: ServiceView[] }[] = [
    ...category.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      services: services.filter((s) => s.subcategoryId === sub.id),
    })),
    {
      id: "other",
      name: category.subcategories.length ? "Other services" : "Services",
      services: services.filter((s) => !s.subcategoryId),
    },
  ].filter((g) => g.services.length > 0);

  return (
    <>
      <PageHero
        eyebrow={
          <Link
            href={routes.services}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All services
          </Link>
        }
        title={
          <span className="flex items-center gap-4">
            <CategoryMedia
              category={category}
              size="lg"
              index={result.catalogue.categories.findIndex(
                (c) => c.id === category.id,
              )}
              className="ring-4 ring-white/10"
            />
            {category.name}
          </span>
        }
        description={category.description}
      />
      <Container className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-8">
            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
                Services for this category are being added. You can still
                request a quote below.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.id} aria-labelledby={`group-${group.id}`}>
                  <h2
                    id={`group-${group.id}`}
                    className="text-lg font-semibold text-foreground"
                  >
                    {group.name}
                  </h2>
                  <ul className="mt-3 divide-y overflow-hidden rounded-2xl border bg-card">
                    {group.services.map((s) => (
                      <li key={s.id} className="px-5 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-medium text-foreground">
                              {s.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {s.description}
                            </p>
                          </div>
                          <Link
                            href={`${routes.newRequest}?service=${s.id}`}
                            className="shrink-0 text-sm font-medium text-primary hover:underline"
                            aria-label={`Request ${s.name}`}
                          >
                            Request
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          <aside className="h-fit rounded-2xl border bg-card p-6 lg:sticky lg:top-24">
            <h2 className="font-semibold text-foreground">
              Need {category.name.toLowerCase()} help?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you&apos;d like to book. Prices are agreed in LKR
              before any work starts.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="urgent" size="xl">
                <Link href={`${routes.newRequest}?mode=urgent&category=${category.id}`}>
                  <Zap data-icon="inline-start" aria-hidden="true" />
                  Get Help Now
                </Link>
              </Button>
              <Button asChild size="xl">
                <Link href={`${routes.newRequest}?category=${category.id}`}>
                  <FileText data-icon="inline-start" aria-hidden="true" />
                  Get a Quote
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}

function CategorySkeleton() {
  return (
    <Container className="py-12 sm:py-16" role="status" aria-label="Loading">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-6 flex gap-5">
        <div className="size-16 animate-pulse rounded-2xl bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-9 w-64 animate-pulse rounded bg-muted" />
          <div className="h-5 w-96 max-w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-10 h-64 animate-pulse rounded-xl bg-muted" />
    </Container>
  );
}

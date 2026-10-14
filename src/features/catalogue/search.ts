import type { Catalogue, CategoryView, ServiceView } from "./types";

export type CatalogueMatch = { category: CategoryView; services: ServiceView[]; categoryMatched: boolean };

function normalise(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Filters the catalogue by free-text query and an optional category. A
 * category matching the query keeps all its services; otherwise only the
 * services that match are kept. Every query word must match (AND).
 */
export function searchCatalogue(
  { categories, services }: Catalogue,
  query: string,
  categoryId: string | null,
): CatalogueMatch[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((w) => text.includes(w));

  return categories
    .filter((c) => !categoryId || c.id === categoryId)
    .map((category) => {
      const own = services.filter((s) => s.categoryId === category.id);
      if (words.length === 0) return { category, services: own, categoryMatched: true };
      const categoryText = normalise(
        [category.name, category.description, ...category.keywords, ...category.subcategories.map((s) => s.name)].join(" "),
      );
      const categoryMatched = matches(categoryText);
      const matchedServices = categoryMatched
        ? own
        : own.filter((s) => matches(normalise(`${s.name} ${s.description}`)));
      return { category, services: matchedServices, categoryMatched };
    })
    .filter((m) => m.categoryMatched || m.services.length > 0);
}

import { z } from "zod";

export const catalogueSlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid identifier");

/** Serialisable views passed from server to client components. */
export type SubcategoryView = { id: string; name: string };

export type CategoryView = {
  id: string;
  name: string;
  description: string;
  icon: string;
  imageURL: string | null;
  keywords: string[];
  subcategories: SubcategoryView[];
};

export type ServiceView = {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  name: string;
  description: string;
};

export type Catalogue = { categories: CategoryView[]; services: ServiceView[] };

export type CatalogueResult =
  | { status: "ok"; catalogue: Catalogue }
  | { status: "unavailable" };

import { describe, expect, it } from "vitest";

import { searchCatalogue } from "./search";
import type { Catalogue } from "./types";

const catalogue: Catalogue = {
  categories: [
    {
      id: "plumbing",
      name: "Plumbing",
      description: "Leaks and drains",
      icon: "droplets",
      imageURL: null,
      keywords: ["pipe", "tap"],
      subcategories: [{ id: "repairs", name: "Repairs" }],
    },
    {
      id: "air-conditioning",
      name: "Air Conditioning",
      description: "AC servicing",
      icon: "air-vent",
      imageURL: null,
      keywords: ["ac", "inverter"],
      subcategories: [],
    },
  ],
  services: [
    { id: "p1", categoryId: "plumbing", subcategoryId: "repairs", name: "Leak repair", description: "Fix leaking pipes" },
    { id: "p2", categoryId: "plumbing", subcategoryId: null, name: "Water pump installation", description: "Install pumps" },
    { id: "a1", categoryId: "air-conditioning", subcategoryId: null, name: "AC general service", description: "Clean filters" },
  ],
};

describe("searchCatalogue", () => {
  it("returns everything for an empty query", () => {
    const result = searchCatalogue(catalogue, "", null);
    expect(result.map((r) => r.category.id)).toEqual(["plumbing", "air-conditioning"]);
    expect(result[0].services).toHaveLength(2);
  });

  it("keeps all services when the category itself matches (name or keyword)", () => {
    const result = searchCatalogue(catalogue, "inverter", null);
    expect(result).toHaveLength(1);
    expect(result[0].category.id).toBe("air-conditioning");
    expect(result[0].services).toHaveLength(1);
  });

  it("narrows to matching services otherwise, requiring every word", () => {
    const result = searchCatalogue(catalogue, "pump install", null);
    expect(result).toHaveLength(1);
    expect(result[0].services.map((s) => s.id)).toEqual(["p2"]);
    expect(searchCatalogue(catalogue, "pump filters", null)).toHaveLength(0);
  });

  it("is case and accent insensitive", () => {
    const result = searchCatalogue(catalogue, "  FÍLTERS ", null);
    expect(result.map((r) => r.category.id)).toEqual(["air-conditioning"]);
    expect(result[0].services.map((s) => s.id)).toEqual(["a1"]);
  });

  it("applies the category filter", () => {
    const result = searchCatalogue(catalogue, "", "air-conditioning");
    expect(result.map((r) => r.category.id)).toEqual(["air-conditioning"]);
    expect(searchCatalogue(catalogue, "leak", "air-conditioning")).toHaveLength(0);
  });
});

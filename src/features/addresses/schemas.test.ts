import { describe, expect, it } from "vitest";

import { addressIdSchema, addressInputSchema } from "./schemas";

const valid = {
  label: "Home",
  recipientName: "Nimal Perera",
  contactNumber: "077 123 4567",
  houseOrBuilding: "No. 12",
  street: "Temple Road",
  city: "Kandy",
  district: "Kandy",
  postalCode: "20000",
  directions: "",
  latitude: "",
  longitude: "",
  makeDefault: false,
};

const errorPaths = (input: unknown) =>
  addressInputSchema.safeParse(input).error?.issues.map((i) => i.path.join(".")) ?? [];

describe("addressInputSchema", () => {
  it("normalises a valid address", () => {
    const result = addressInputSchema.parse(valid);
    expect(result.contactNumber).toBe("+94771234567");
    expect(result.directions).toBeNull();
    expect(result.latitude).toBeNull();
  });

  it("accepts Sri Lankan landlines as contact numbers", () => {
    expect(addressInputSchema.parse({ ...valid, contactNumber: "011 234 5678" }).contactNumber).toBe("+94112345678");
  });

  it.each(["0771234", "+447700900123", "abc"])("rejects contact number %s", (contactNumber) => {
    expect(errorPaths({ ...valid, contactNumber })).toContain("contactNumber");
  });

  it("requires the core address fields", () => {
    const paths = errorPaths({ ...valid, houseOrBuilding: "", street: "", city: "", district: "" });
    expect(paths).toEqual(expect.arrayContaining(["houseOrBuilding", "street", "city", "district"]));
  });

  it("validates postal codes when given", () => {
    expect(errorPaths({ ...valid, postalCode: "2000" })).toContain("postalCode");
    expect(addressInputSchema.parse({ ...valid, postalCode: "" }).postalCode).toBeNull();
  });

  it("needs both coordinates, inside Sri Lanka", () => {
    expect(errorPaths({ ...valid, latitude: "6.9271" })).toContain("longitude");
    expect(errorPaths({ ...valid, latitude: "51.5", longitude: "-0.12" })).toEqual(
      expect.arrayContaining(["latitude", "longitude"]),
    );
    const ok = addressInputSchema.parse({ ...valid, latitude: "6.9271", longitude: "79.8612" });
    expect(ok.latitude).toBeCloseTo(6.9271);
  });

  it("strips anything not in the schema (e.g. an owner id)", () => {
    expect(addressInputSchema.parse({ ...valid, uid: "someone-else" })).not.toHaveProperty("uid");
  });
});

describe("addressIdSchema", () => {
  it("rejects ids that could escape the user's folder", () => {
    expect(addressIdSchema.safeParse("../../users/x").success).toBe(false);
    expect(addressIdSchema.safeParse("a/b").success).toBe(false);
    expect(addressIdSchema.safeParse("Xk2s9QwErTy0pLm3NbVc").success).toBe(true);
  });
});

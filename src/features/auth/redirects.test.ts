import { describe, expect, it } from "vitest";

import { canAccessPath, homePathFor, postLoginPath, safeNextPath } from "./redirects";

describe("homePathFor", () => {
  it("sends each role to its own dashboard", () => {
    expect(homePathFor({ role: "customer" })).toBe("/customer/dashboard");
    expect(homePathFor({ role: "technician" })).toBe("/technician/dashboard");
    expect(homePathFor({ role: "admin" })).toBe("/admin/dashboard");
  });

  it("shows pending and rejected applicants their application status, not a technician area", () => {
    expect(homePathFor({ role: "customer", applicationStatus: "pending" })).toBe("/technician/application");
    expect(homePathFor({ role: "customer", applicationStatus: "under_review" })).toBe("/technician/application");
    expect(homePathFor({ role: "customer", applicationStatus: "rejected" })).toBe("/technician/application");
  });

  it("sends accounts without a profile to finish setup", () => {
    expect(homePathFor({ role: null })).toBe("/complete-profile");
  });
});

describe("canAccessPath", () => {
  it("blocks customers from technician and admin areas", () => {
    expect(canAccessPath("customer", "/technician/dashboard")).toBe(false);
    expect(canAccessPath("customer", "/admin/dashboard")).toBe(false);
    expect(canAccessPath("customer", "/customer/profile")).toBe(true);
  });

  it("blocks technicians from admin and customer areas", () => {
    expect(canAccessPath("technician", "/admin/technician-applications")).toBe(false);
    expect(canAccessPath("technician", "/customer/dashboard")).toBe(false);
    expect(canAccessPath("technician", "/technician/dashboard")).toBe(true);
  });

  it("does not treat look-alike prefixes as the protected area", () => {
    expect(canAccessPath("customer", "/administrator-guide")).toBe(true);
    expect(canAccessPath(null, "/admin")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["https://evil.example/phish", null],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["javascript:alert(1)", null],
    ["/customer/profile\r\nSet-Cookie: x", null],
    ["customer/profile", null],
    ["/customer/profile?tab=address", "/customer/profile?tab=address"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("postLoginPath", () => {
  it("honours `next` only when the role may open it", () => {
    expect(postLoginPath({ role: "customer" }, "/customer/profile")).toBe("/customer/profile");
    expect(postLoginPath({ role: "customer" }, "/admin/dashboard")).toBe("/customer/dashboard");
    expect(postLoginPath({ role: "admin" }, "https://evil.example")).toBe("/admin/dashboard");
  });

  it("never bounces back to an auth page", () => {
    expect(postLoginPath({ role: "customer" }, "/login")).toBe("/customer/dashboard");
  });
});

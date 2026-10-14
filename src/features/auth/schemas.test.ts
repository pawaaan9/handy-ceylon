import { describe, expect, it } from "vitest";

import { passwordSchema, signUpSchema, sriLankaMobileSchema } from "./schemas";

describe("sriLankaMobileSchema", () => {
  it.each([
    ["0771234567", "+94771234567"],
    ["077 123 4567", "+94771234567"],
    ["+94 77 123 4567", "+94771234567"],
    ["94771234567", "+94771234567"],
    ["0094771234567", "+94771234567"],
  ])("normalises %s", (input, expected) => {
    expect(sriLankaMobileSchema.parse(input)).toBe(expected);
  });

  it.each(["0112345678", "077123456", "+447700900123", "abc"])("rejects %s", (input) => {
    expect(sriLankaMobileSchema.safeParse(input).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires length, upper, lower and a digit", () => {
    expect(passwordSchema.safeParse("Short1").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase1").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE1").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigitsHere").success).toBe(false);
    expect(passwordSchema.safeParse("Valid1Password").success).toBe(true);
  });
});

describe("signUpSchema", () => {
  const valid = {
    fullName: "Nimal Perera",
    email: "Nimal@Example.com",
    phoneNumber: "0771234567",
    password: "Valid1Password",
    confirmPassword: "Valid1Password",
    acceptTerms: true,
  };

  it("accepts valid input and normalises email", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("nimal@example.com");
  });

  it("ignores any attempt to pass a role", () => {
    const result = signUpSchema.parse({ ...valid, role: "admin" });
    expect(result).not.toHaveProperty("role");
  });

  it("rejects mismatched passwords and unaccepted terms", () => {
    const mismatch = signUpSchema.safeParse({ ...valid, confirmPassword: "Other1Password" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(signUpSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });
});

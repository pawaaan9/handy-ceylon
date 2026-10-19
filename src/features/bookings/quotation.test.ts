import { describe, expect, it } from "vitest";

import { technicianEligibility } from "./eligibility";
import { addDays, colomboToday } from "@/lib/dates";

import { computeQuotationTotals, quotationDifferences } from "./quotation";
import {
  acceptUrgentRequestSchema,
  decideQuotationSchema,
  MAX_QUOTATION_LINES,
  submitQuotationSchema,
  submitRemoteQuotationSchema,
  submitVisitOfferSchema,
} from "./schemas";

const quotation = (overrides: Record<string, unknown> = {}) => ({
  bookingId: "b1",
  submissionKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  inspectionFindings: "The trap seal has perished and the waste pipe joint is loose.",
  lineItems: [
    { kind: "labour", description: "Replace trap and reseal joint", quantity: "1", unitPriceLkr: "2500" },
    { kind: "materials", description: "PVC P-trap", quantity: "2", unitPriceLkr: "850" },
    { kind: "additional", description: "Weekend call-out", quantity: 1, unitPriceLkr: 500 },
  ],
  estimatedDurationHours: "",
  notes: "",
  ...overrides,
});

describe("quotation totals", () => {
  it("sums labour, materials, additional charges and the inspection fee in whole rupees", () => {
    const input = submitQuotationSchema.parse(quotation());
    const totals = computeQuotationTotals(input.lineItems, 1000);
    expect(totals.lineItems.map((l) => l.amountLkr)).toEqual([2500, 1700, 500]);
    expect(totals).toMatchObject({
      labourLkr: 2500,
      materialsLkr: 1700,
      additionalLkr: 500,
      inspectionFeeLkr: 1000,
      totalLkr: 5700,
    });
    expect(Number.isInteger(totals.totalLkr)).toBe(true);
  });

  it("rejects cents, negative amounts and fractional quantities", () => {
    const line = (o: Record<string, unknown>) => quotation({ lineItems: [{ kind: "labour", description: "Fix", quantity: "1", unitPriceLkr: "100", ...o }] });
    expect(submitQuotationSchema.safeParse(line({ unitPriceLkr: "99.50" })).success).toBe(false);
    expect(submitQuotationSchema.safeParse(line({ unitPriceLkr: "-5" })).success).toBe(false);
    expect(submitQuotationSchema.safeParse(line({ unitPriceLkr: "" })).success).toBe(false);
    expect(submitQuotationSchema.safeParse(line({ quantity: "1.5" })).success).toBe(false);
  });

  it("requires findings, at least one item and a total above zero", () => {
    expect(submitQuotationSchema.safeParse(quotation({ inspectionFindings: "short" })).success).toBe(false);
    expect(submitQuotationSchema.safeParse(quotation({ lineItems: [] })).success).toBe(false);
    const zero = quotation({ lineItems: [{ kind: "labour", description: "Free check", quantity: 1, unitPriceLkr: 0 }] });
    expect(submitQuotationSchema.safeParse(zero).error?.issues[0].message).toMatch(/more than LKR 0/);
    const many = Array.from({ length: MAX_QUOTATION_LINES + 1 }, () => ({ kind: "materials", description: "Item", quantity: 1, unitPriceLkr: 10 }));
    expect(submitQuotationSchema.safeParse(quotation({ lineItems: many })).success).toBe(false);
  });

});

describe("acceptUrgentRequestSchema", () => {
  it("takes the inspection fee as whole rupees, 0 meaning free", () => {
    expect(acceptUrgentRequestSchema.parse({ requestId: "r1", inspectionFeeLkr: "0", etaMinutes: "30", message: "" })).toEqual({
      requestId: "r1",
      inspectionFeeLkr: 0,
      etaMinutes: 30,
      message: null,
    });
    expect(acceptUrgentRequestSchema.safeParse({ requestId: "r1", inspectionFeeLkr: "1500.5", etaMinutes: 30, message: "" }).success).toBe(false);
    expect(acceptUrgentRequestSchema.safeParse({ requestId: "r1", inspectionFeeLkr: "30000", etaMinutes: 30, message: "" }).success).toBe(false);
    expect(acceptUrgentRequestSchema.safeParse({ requestId: "r1", inspectionFeeLkr: "0", etaMinutes: 600, message: "" }).success).toBe(false);
  });
});

describe("technicianEligibility", () => {
  const tech: Parameters<typeof technicianEligibility>[1] = {
    accountStatus: "active",
    verificationStatus: "approved",
    availability: "online",
    categoryIds: ["plumbing"],
    serviceDistricts: ["Kandy"],
  };
  const request: Parameters<typeof technicianEligibility>[2] = {
    customerId: "alice",
    categoryId: "plumbing",
    district: "Kandy",
  };

  it("accepts an online, approved technician covering the category and district", () => {
    expect(technicianEligibility("tom", tech, request)).toEqual({ eligible: true });
  });

  it("explains each reason a technician can't take the job", () => {
    const reason = (t: Partial<typeof tech>, r: Partial<typeof request> = {}, uid = "tom") => {
      const result = technicianEligibility(uid, { ...tech, ...t }, { ...request, ...r });
      return result.eligible ? null : result.reason;
    };
    expect(reason({ availability: "offline" })).toMatch(/Go online/);
    expect(reason({ verificationStatus: "suspended" })).toMatch(/isn't active/);
    expect(reason({ accountStatus: "disabled" as never })).toMatch(/isn't active/);
    expect(reason({}, { categoryId: "electrical" })).toMatch(/categories/);
    expect(reason({}, { district: "Galle" })).toMatch(/districts/);
    expect(reason({}, {}, "alice")).toMatch(/your own request/);
  });
});

describe("quotationDifferences", () => {
  it("itemizes added, removed and changed lines and the total change", () => {
    const line = (kind: "labour" | "materials" | "additional", description: string, amountLkr: number) => ({
      kind,
      description,
      quantity: 1,
      unitPriceLkr: amountLkr,
      amountLkr,
    });
    const diff = quotationDifferences(
      { lineItems: [line("labour", "Tile floor", 20000), line("materials", "Tiles", 30000)], totalLkr: 50000 },
      {
        lineItems: [line("labour", "Tile floor", 26000), line("materials", "tiles ", 30000), line("additional", "Damp treatment", 8000)],
        totalLkr: 64000,
      },
    );
    expect(diff.added.map((l) => l.description)).toEqual(["Damp treatment"]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([{ kind: "labour", description: "Tile floor", beforeLkr: 20000, afterLkr: 26000 }]);
    expect(diff.totalChangeLkr).toBe(14000);
  });
});

describe("Get a Quote schemas", () => {
  const today = colomboToday();

  it("takes a visit fee and up to three distinct, upcoming visit times", () => {
    const offer = (o: Record<string, unknown>) =>
      submitVisitOfferSchema.safeParse({
        requestId: "r1",
        inspectionFeeLkr: "1500",
        proposedVisits: [{ date: addDays(today, 1), timeSlot: "morning" }],
        message: "",
        ...o,
      });
    expect(offer({}).success).toBe(true);
    expect(offer({ proposedVisits: [] }).success).toBe(false);
    expect(offer({ proposedVisits: [{ date: addDays(today, -1), timeSlot: "morning" }] }).success).toBe(false);
    expect(offer({ proposedVisits: [{ date: addDays(today, 31), timeSlot: "morning" }] }).success).toBe(false);
    const same = { date: addDays(today, 2), timeSlot: "evening" };
    expect(offer({ proposedVisits: [same, same] }).success).toBe(false);
    const four = [1, 2, 3, 4].map((d) => ({ date: addDays(today, d), timeSlot: "morning" }));
    expect(offer({ proposedVisits: four }).success).toBe(false);
    expect(offer({ inspectionFeeLkr: "1500.50" }).success).toBe(false);
  });

  it("requires a timeline and a validity period for online quotations", () => {
    const quote = (o: Record<string, unknown>) =>
      submitRemoteQuotationSchema.safeParse({
        requestId: "r1",
        submissionKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
        lineItems: [{ kind: "labour", description: "Paint living room", quantity: 1, unitPriceLkr: 25000 }],
        estimatedDurationHours: "16",
        exclusions: "Ceiling",
        assumptions: "Walls are sound",
        notes: "",
        validForDays: "7",
        ...o,
      });
    expect(quote({}).success).toBe(true);
    expect(quote({ estimatedDurationHours: "" }).success).toBe(false);
    expect(quote({ validForDays: "0" }).success).toBe(false);
    expect(quote({ validForDays: "31" }).success).toBe(false);
  });

  it("needs a reason to ask for a revision or reject, not to approve", () => {
    const decide = (decision: string, reason: string) => decideQuotationSchema.safeParse({ quotationId: "q1", decision, reason }).success;
    expect(decide("approve", "")).toBe(true);
    expect(decide("request_revision", "")).toBe(false);
    expect(decide("request_revision", "Use cheaper tiles")).toBe(true);
    expect(decide("reject", "")).toBe(false);
  });
});

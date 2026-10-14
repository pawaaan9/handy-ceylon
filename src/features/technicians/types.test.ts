import { describe, expect, it } from "vitest";

import { canTransition, nextStatuses } from "@/lib/state-machine";

import { reviewApplicationSchema } from "./schemas";
import { applicationTransitions } from "./types";

describe("technician application transitions", () => {
  it("only admins can approve or reject", () => {
    expect(canTransition(applicationTransitions, "pending", "approved", "admin")).toBe(true);
    expect(canTransition(applicationTransitions, "pending", "approved", "customer")).toBe(false);
    expect(canTransition(applicationTransitions, "pending", "approved", "applicant")).toBe(false);
    expect(canTransition(applicationTransitions, "pending", "approved", "technician")).toBe(false);
  });

  it("applicants may only resubmit after rejection", () => {
    expect(nextStatuses(applicationTransitions, "rejected", "applicant")).toEqual(["pending"]);
    expect(nextStatuses(applicationTransitions, "pending", "applicant")).toEqual([]);
    expect(nextStatuses(applicationTransitions, "approved", "applicant")).toEqual([]);
  });

  it("approval is final", () => {
    expect(nextStatuses(applicationTransitions, "approved", "admin")).toEqual([]);
  });
});

describe("reviewApplicationSchema", () => {
  it("requires a reason when rejecting", () => {
    expect(
      reviewApplicationSchema.safeParse({ applicantUid: "u1", decision: "rejected" }).success,
    ).toBe(false);
    expect(
      reviewApplicationSchema.safeParse({
        applicantUid: "u1",
        decision: "rejected",
        rejectionReason: "Please upload a clearer NVQ certificate.",
      }).success,
    ).toBe(true);
  });
});

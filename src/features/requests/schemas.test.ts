import { describe, expect, it } from "vitest";

import {
  addDays,
  cancelServiceRequestSchema,
  colomboToday,
  createServiceRequestSchema,
  requestStepSchemas,
  validateAttachmentFile,
} from "./schemas";
import { MAX_ATTACHMENTS, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "./types";

const photo = (n = 1) => ({
  storagePath: `requestMedia/alice/key-1234567890abcdef/${n}-sink.jpg`,
  contentType: "image/jpeg",
  sizeBytes: 200_000,
  name: `sink-${n}.jpg`,
});
const video = (n = 1) => ({ ...photo(n), storagePath: `requestMedia/alice/key-1234567890abcdef/${n}-leak.mp4`, contentType: "video/mp4" });

const valid = (overrides: Record<string, unknown> = {}) => ({
  submissionKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  mode: "quote_visit",
  categoryId: "plumbing",
  serviceId: "leak-repair",
  addressId: "Xk2ab9QmZ1",
  title: "Kitchen sink leaking",
  description: "Water drips from the trap under the kitchen sink whenever the tap is used.",
  urgency: "normal",
  timing: "scheduled",
  preferredDate: addDays(colomboToday(), 2),
  preferredTimeSlot: "morning",
  accessInstructions: "",
  measurements: "",
  attachments: [],
  ...overrides,
});

const errorPaths = (input: unknown) =>
  createServiceRequestSchema.safeParse(input).error?.issues.map((i) => i.path.join(".")) ?? [];

describe("createServiceRequestSchema", () => {
  it("normalises a valid request into a preferred schedule", () => {
    const result = createServiceRequestSchema.parse(valid({ measurements: "2 m pipe" }));
    expect(result.preferredSchedule).toEqual({
      kind: "scheduled",
      date: addDays(colomboToday(), 2),
      timeSlot: "morning",
    });
    expect(result.accessInstructions).toBeNull();
    // Measurements are only kept for Quote Online.
    expect(result.measurements).toBeNull();
    expect(result).not.toHaveProperty("timing");
  });

  it("requires every core field", () => {
    const paths = errorPaths({
      ...valid(),
      mode: "",
      categoryId: "",
      serviceId: "",
      addressId: "",
      title: "",
      description: "short",
      urgency: "",
    });
    expect(paths).toEqual(
      expect.arrayContaining(["mode", "categoryId", "serviceId", "addressId", "title", "description", "urgency"]),
    );
  });

  it("rejects malformed ids and submission keys", () => {
    expect(errorPaths(valid({ categoryId: "../admins" }))).toContain("categoryId");
    expect(errorPaths(valid({ addressId: "a/b" }))).toContain("addressId");
    expect(errorPaths(valid({ submissionKey: "short" }))).toContain("submissionKey");
  });

  it("keeps Get Help Now for urgent, as-soon-as-possible jobs", () => {
    const urgent = { mode: "urgent", timing: "asap", preferredDate: "", preferredTimeSlot: "", urgency: "emergency" };
    expect(createServiceRequestSchema.parse(valid(urgent)).preferredSchedule).toEqual({ kind: "asap" });
    expect(errorPaths(valid({ ...urgent, urgency: "low" }))).toEqual(["urgency"]);
    expect(errorPaths(valid({ ...urgent, timing: "scheduled" }))).toContain("timing");
  });

  it("asks quote requests for a date or flexibility, not ASAP", () => {
    expect(errorPaths(valid({ timing: "asap" }))).toEqual(["timing"]);
    expect(createServiceRequestSchema.parse(valid({ timing: "flexible", preferredDate: "" })).preferredSchedule).toEqual({
      kind: "flexible",
    });
  });

  it("validates the preferred date and time", () => {
    expect(errorPaths(valid({ preferredDate: "" }))).toEqual(["preferredDate"]);
    expect(errorPaths(valid({ preferredDate: "2026-02-30" }))).toEqual(["preferredDate"]);
    expect(errorPaths(valid({ preferredDate: addDays(colomboToday(), -1) }))).toEqual(["preferredDate"]);
    expect(errorPaths(valid({ preferredDate: addDays(colomboToday(), 61) }))).toEqual(["preferredDate"]);
    expect(errorPaths(valid({ preferredDate: colomboToday() }))).toEqual([]);
    expect(errorPaths(valid({ preferredTimeSlot: "" }))).toEqual(["preferredTimeSlot"]);
    expect(errorPaths(valid({ preferredTimeSlot: "midnight" }))).toContain("preferredTimeSlot");
  });

  it("requires a photo or video for Quote Online and keeps its measurements", () => {
    expect(errorPaths(valid({ mode: "quote_online" }))).toEqual(["attachments"]);
    const result = createServiceRequestSchema.parse(
      valid({ mode: "quote_online", attachments: [photo()], measurements: "Wall 4 m × 2.7 m" }),
    );
    expect(result.measurements).toBe("Wall 4 m × 2.7 m");
  });

  it("limits attachments", () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => photo(i));
    expect(errorPaths(valid({ attachments: many }))).toContain("attachments");
    expect(errorPaths(valid({ attachments: [video(1), video(2), video(3)] }))).toEqual(["attachments"]);
    expect(errorPaths(valid({ attachments: [photo(1), photo(1)] }))).toEqual(["attachments"]);
  });
});

describe("requestStepSchemas", () => {
  it("checks only the current step's fields", () => {
    const values = valid({ title: "", addressId: "" });
    expect(requestStepSchemas.service.safeParse(values).success).toBe(true);
    expect(requestStepSchemas.address.safeParse(values).error?.issues.map((i) => i.path[0])).toEqual(["addressId"]);
    expect(requestStepSchemas.details.safeParse(values).error?.issues.map((i) => i.path[0])).toEqual(["title"]);
  });

  it("applies mode rules on the details and attachments steps", () => {
    expect(requestStepSchemas.details.safeParse(valid({ mode: "urgent", urgency: "low", timing: "asap" })).success).toBe(false);
    expect(requestStepSchemas.attachments.safeParse(valid({ mode: "quote_online" })).success).toBe(false);
  });
});

describe("validateAttachmentFile", () => {
  it("accepts photos and short videos within the limits", () => {
    expect(validateAttachmentFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(validateAttachmentFile({ type: "image/heic", size: 1_000 })).toBeNull();
    expect(validateAttachmentFile({ type: "video/quicktime", size: MAX_VIDEO_BYTES })).toBeNull();
  });

  it("rejects other types, empty files and oversized files", () => {
    expect(validateAttachmentFile({ type: "application/pdf", size: 1_000 })).toMatch(/photo/);
    expect(validateAttachmentFile({ type: "image/svg+xml", size: 1_000 })).not.toBeNull();
    expect(validateAttachmentFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validateAttachmentFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toMatch(/10 MB/);
    expect(validateAttachmentFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).toMatch(/50 MB/);
  });
});

describe("cancelServiceRequestSchema", () => {
  it("requires a known reason", () => {
    expect(cancelServiceRequestSchema.safeParse({ requestId: "abc", reason: "", note: "" }).success).toBe(false);
    expect(cancelServiceRequestSchema.parse({ requestId: "abc", reason: "other", note: " " }).note).toBeNull();
  });
});

describe("colomboToday", () => {
  it("uses Sri Lanka time (UTC+5:30)", () => {
    expect(colomboToday(new Date("2026-10-19T18:29:00Z"))).toBe("2026-10-19");
    expect(colomboToday(new Date("2026-10-19T18:31:00Z"))).toBe("2026-10-20");
  });
});

import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const elevenMb = new Uint8Array(11 * 1024 * 1024);

beforeAll(async () => {
  const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST!.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-handy-ceylon-rules",
    storage: { rules: readFileSync("storage.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearStorage());

const verifiedUser = (uid: string, role = "customer") =>
  env.authenticatedContext(uid, { role, email_verified: true }).storage();

describe("technician documents", () => {
  it("owners with a verified email can upload PDFs and images to their own folder", async () => {
    await assertSucceeds(
      uploadBytes(ref(verifiedUser("alice"), "technicianDocuments/alice/nvq.pdf"), pdf, {
        contentType: "application/pdf",
      }),
    );
  });

  it("rejects unverified emails, other users' folders, wrong types and large files", async () => {
    const unverified = env.authenticatedContext("alice", { role: "customer", email_verified: false }).storage();
    await assertFails(
      uploadBytes(ref(unverified, "technicianDocuments/alice/nvq.pdf"), pdf, { contentType: "application/pdf" }),
    );
    await assertFails(
      uploadBytes(ref(verifiedUser("bob"), "technicianDocuments/alice/fake.pdf"), pdf, {
        contentType: "application/pdf",
      }),
    );
    await assertFails(
      uploadBytes(ref(verifiedUser("alice"), "technicianDocuments/alice/run.exe"), pdf, {
        contentType: "application/x-msdownload",
      }),
    );
    await assertFails(
      uploadBytes(ref(verifiedUser("alice"), "technicianDocuments/alice/big.pdf"), elevenMb, {
        contentType: "application/pdf",
      }),
    );
  });

  it("documents are private to the owner and admins", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), "technicianDocuments/alice/nvq.pdf"), pdf, {
        contentType: "application/pdf",
      });
    });
    await assertSucceeds(getBytes(ref(verifiedUser("alice"), "technicianDocuments/alice/nvq.pdf")));
    await assertSucceeds(getBytes(ref(verifiedUser("admin1", "admin"), "technicianDocuments/alice/nvq.pdf")));
    await assertFails(getBytes(ref(verifiedUser("bob"), "technicianDocuments/alice/nvq.pdf")));
    await assertFails(getBytes(ref(verifiedUser("tech", "technician"), "technicianDocuments/alice/nvq.pdf")));
  });
});

describe("avatars", () => {
  it("owners may upload small images only", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await assertSucceeds(
      uploadBytes(ref(verifiedUser("alice"), "users/alice/avatar/me.png"), png, { contentType: "image/png" }),
    );
    await assertFails(
      uploadBytes(ref(verifiedUser("bob"), "users/alice/avatar/me.png"), png, { contentType: "image/png" }),
    );
    await assertFails(
      uploadBytes(ref(verifiedUser("alice"), "users/alice/avatar/me.svg"), png, { contentType: "image/svg+xml" }),
    );
  });
});

describe("default deny", () => {
  it("blocks paths not listed in the rules", async () => {
    await assertFails(
      uploadBytes(ref(verifiedUser("alice"), "anything/else.txt"), pdf, { contentType: "text/plain" }),
    );
  });
});

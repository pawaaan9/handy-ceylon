import { beforeEach, describe, expect, it } from "vitest";

import { deleteAddress, updateAddress } from "@/features/addresses/server/repository";
import { addDays, colomboToday, createServiceRequestSchema } from "@/features/requests/schemas";
import {
  cancelServiceRequest,
  createServiceRequest,
  getCustomerRequest,
  listCustomerRequests,
  requestIdFor,
} from "@/features/requests/server/repository";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { storagePaths } from "@/lib/firestore/collections";

import { addressInput, createCustomerWithAddress, resetEmulators, seedCatalogue, uploadAs } from "./helpers";

beforeEach(async () => {
  await resetEmulators();
  await seedCatalogue();
});

const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";

const request = (addressId: string, overrides: Record<string, unknown> = {}) =>
  createServiceRequestSchema.parse({
    submissionKey: KEY,
    mode: "quote_visit",
    categoryId: "plumbing",
    serviceId: "leak-repair",
    addressId,
    title: "Kitchen sink leaking",
    description: "Water drips from the trap under the kitchen sink whenever the tap is used.",
    urgency: "normal",
    timing: "scheduled",
    preferredDate: addDays(colomboToday(), 3),
    preferredTimeSlot: "afternoon",
    accessInstructions: "Ring the bell twice",
    measurements: "",
    attachments: [],
    ...overrides,
  });

const fileExists = async (path: string) => (await adminStorage().bucket().file(path).exists())[0];

async function twoCustomers() {
  const alice = await createCustomerWithAddress("alice@example.com", "0771234567");
  const bob = await createCustomerWithAddress("bob@example.com", "0779999999");
  return { alice, bob };
}

describe("creating a service request", () => {
  it("stores server-set fields, readable snapshots, private details and an audit event", async () => {
    const { alice } = await twoCustomers();
    const { id, created } = await createServiceRequest(alice.uid, request(alice.addressId));
    expect(created).toBe(true);
    expect(id).toBe(requestIdFor(alice.uid, KEY));

    const doc = (await adminDb().doc(`serviceRequests/${id}`).get()).data()!;
    expect(doc).toMatchObject({
      customerId: alice.uid,
      mode: "quote_visit",
      status: "open",
      categoryId: "plumbing",
      serviceId: "leak-repair",
      catalogue: { categoryName: "Plumbing", serviceName: "Leak repair", subcategoryName: "Leaks" },
      city: "Kandy",
      district: "Kandy",
      selectedTechnicianId: null,
      cancellation: null,
      offerCount: 0,
    });
    // The public request document never carries the precise address.
    expect(doc).not.toHaveProperty("address");
    expect(doc.createdAt.toMillis()).toBeGreaterThan(Date.now() - 60_000);

    const view = (await getCustomerRequest(alice.uid, id))!;
    expect(view.address).toMatchObject({ addressId: alice.addressId, street: "Temple Road", directions: "Blue gate" });
    expect(view.accessInstructions).toBe("Ring the bell twice");
    expect(view.history).toEqual([expect.objectContaining({ from: null, to: "open", actorRole: "customer" })]);
    expect(view.canCancel).toBe(true);
    expect((await listCustomerRequests(alice.uid)).map((r) => r.id)).toEqual([id]);
  });

  it("keeps the address snapshot when the saved address is edited", async () => {
    const { alice } = await twoCustomers();
    const { id } = await createServiceRequest(alice.uid, request(alice.addressId));
    await updateAddress(alice.uid, alice.addressId, addressInput({ street: "Lake Road", city: "Galle", district: "Galle" }));

    const view = (await getCustomerRequest(alice.uid, id))!;
    expect(view.address).toMatchObject({ street: "Temple Road", city: "Kandy" });
    expect(view.city).toBe("Kandy");
    // An open request still protects the address it uses.
    await expect(deleteAddress(alice.uid, alice.addressId)).rejects.toThrow(/active request/);
  });

  it("refuses inactive services and services from another category", async () => {
    const { alice } = await twoCustomers();
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { serviceId: "retired-service" })),
    ).rejects.toThrow(/not available/);
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { serviceId: "rewiring" })),
    ).rejects.toThrow(/selected category/);
    expect((await listCustomerRequests(alice.uid)).length).toBe(0);
  });
});

describe("duplicate submissions", () => {
  it("creates one request when the same submission is sent twice at once", async () => {
    const { alice } = await twoCustomers();
    const input = request(alice.addressId);
    const results = await Promise.all([
      createServiceRequest(alice.uid, input),
      createServiceRequest(alice.uid, input),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(results.filter((r) => r.created).length).toBe(1);

    const all = await adminDb().collection("serviceRequests").where("customerId", "==", alice.uid).get();
    expect(all.size).toBe(1);
    const history = await adminDb().collection(`serviceRequests/${results[0].id}/history`).get();
    expect(history.size).toBe(1);
  });

  it("returns the existing request when a submission is retried later", async () => {
    const { alice } = await twoCustomers();
    const first = await createServiceRequest(alice.uid, request(alice.addressId));
    const retry = await createServiceRequest(alice.uid, request(alice.addressId, { title: "Changed title" }));
    expect(retry).toEqual({ id: first.id, created: false });
    expect((await getCustomerRequest(alice.uid, first.id))!.title).toBe("Kitchen sink leaking");

    const another = await createServiceRequest(
      alice.uid,
      request(alice.addressId, { submissionKey: "1b4e28ba-2fa1-11d2-883f-0016d3cca427" }),
    );
    expect(another.id).not.toBe(first.id);
  });

  it("derives different ids for different customers using the same key", () => {
    expect(requestIdFor("alice", KEY)).not.toBe(requestIdFor("bob", KEY));
    expect(requestIdFor("alice", KEY)).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});

describe("ownership", () => {
  it("hides one customer's request from another and blocks their cancellation", async () => {
    const { alice, bob } = await twoCustomers();
    const { id } = await createServiceRequest(alice.uid, request(alice.addressId));

    expect(await getCustomerRequest(bob.uid, id)).toBeNull();
    expect(await listCustomerRequests(bob.uid)).toEqual([]);
    await expect(
      cancelServiceRequest(bob.uid, { requestId: id, reason: "other", note: null }),
    ).rejects.toThrow(/could not be found/);
    expect((await getCustomerRequest(alice.uid, id))!.status).toBe("open");
  });

  it("refuses another customer's saved address", async () => {
    const { alice, bob } = await twoCustomers();
    await expect(createServiceRequest(bob.uid, request(alice.addressId))).rejects.toThrow(/address could not be found/);
  });

  it("lets the owner cancel an open request once, with an audit event", async () => {
    const { alice } = await twoCustomers();
    const { id } = await createServiceRequest(alice.uid, request(alice.addressId));
    await cancelServiceRequest(alice.uid, { requestId: id, reason: "found_someone_else", note: "Neighbour fixed it" });

    const view = (await getCustomerRequest(alice.uid, id))!;
    expect(view.status).toBe("cancelled");
    expect(view.cancellation).toMatchObject({ by: "customer", reason: "found_someone_else", note: "Neighbour fixed it" });
    expect(view.history.map((e) => e.to)).toEqual(["open", "cancelled"]);
    expect(view.canCancel).toBe(false);
    // A retried cancellation is a no-op, not a second event.
    await cancelServiceRequest(alice.uid, { requestId: id, reason: "other", note: null });
    expect((await getCustomerRequest(alice.uid, id))!.history.length).toBe(2);
    // A cancelled request no longer protects its address.
    await expect(deleteAddress(alice.uid, alice.addressId)).resolves.toBeUndefined();
  });
});

describe("attachments", () => {
  const draft = (uid: string, name: string) => `${storagePaths.requestDraftPrefix(uid, KEY)}${name}`;
  const ref = (storagePath: string, contentType = "image/jpeg") => ({
    storagePath,
    contentType,
    sizeBytes: 4,
    name: storagePath.split("/").pop()!,
  });

  it("verifies uploads and moves them into the request's server-owned folder", async () => {
    const { alice } = await twoCustomers();
    await uploadAs(draft(alice.uid, "1-sink.jpg"), "image/jpeg");
    await uploadAs(draft(alice.uid, "2-leak.mp4"), "video/mp4");
    await uploadAs(draft(alice.uid, "3-removed.jpg"), "image/jpeg"); // uploaded, then removed in the form

    const { id } = await createServiceRequest(
      alice.uid,
      request(alice.addressId, {
        mode: "quote_online",
        attachments: [ref(draft(alice.uid, "1-sink.jpg")), ref(draft(alice.uid, "2-leak.mp4"), "video/mp4")],
      }),
    );

    const view = (await getCustomerRequest(alice.uid, id))!;
    expect(view.attachments.map((a) => [a.storagePath, a.kind, a.contentType])).toEqual([
      [`serviceRequests/${id}/media/1-sink.jpg`, "image", "image/jpeg"],
      [`serviceRequests/${id}/media/2-leak.mp4`, "video", "video/mp4"],
    ]);
    expect(await fileExists(`serviceRequests/${id}/media/1-sink.jpg`)).toBe(true);
    // The whole draft folder is cleaned up.
    expect(await fileExists(draft(alice.uid, "1-sink.jpg"))).toBe(false);
    expect(await fileExists(draft(alice.uid, "3-removed.jpg"))).toBe(false);
  });

  it("uses the stored file's real type, not the type the browser claimed", async () => {
    const { alice } = await twoCustomers();
    await uploadAs(draft(alice.uid, "notes.jpg"), "text/plain");
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { attachments: [ref(draft(alice.uid, "notes.jpg"))] })),
    ).rejects.toThrow(/JPG, PNG/);
  });

  it("rejects oversized, missing and other people's files", async () => {
    const { alice, bob } = await twoCustomers();
    await uploadAs(draft(alice.uid, "huge.jpg"), "image/jpeg", Buffer.alloc(10 * 1024 * 1024 + 1));
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { attachments: [ref(draft(alice.uid, "huge.jpg"))] })),
    ).rejects.toThrow(/10 MB/);

    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { attachments: [ref(draft(alice.uid, "never.jpg"))] })),
    ).rejects.toThrow(/missing/);

    await uploadAs(draft(bob.uid, "bobs.jpg"), "image/jpeg");
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { attachments: [ref(draft(bob.uid, "bobs.jpg"))] })),
    ).rejects.toThrow(/can't be used/);
    await expect(
      createServiceRequest(alice.uid, request(alice.addressId, { attachments: [ref("avatars/x/photo.jpg")] })),
    ).rejects.toThrow(/can't be used/);
    expect((await listCustomerRequests(alice.uid)).length).toBe(0);
  });

  it("counts videos by their stored type", async () => {
    const { alice } = await twoCustomers();
    for (const n of [1, 2, 3]) await uploadAs(draft(alice.uid, `${n}.mp4`), "video/mp4");
    // The browser claims they're photos; the server reads the real metadata.
    const attachments = [1, 2, 3].map((n) => ref(draft(alice.uid, `${n}.mp4`), "image/jpeg"));
    await expect(createServiceRequest(alice.uid, request(alice.addressId, { attachments }))).rejects.toThrow(
      /up to 2 videos/,
    );
  });
});

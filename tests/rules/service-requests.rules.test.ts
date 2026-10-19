import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/*
 * Security Rules for service requests and their media. Requests are written
 * only by the server, so every client write must fail, and reads follow
 * ownership. Storage reads of submitted media check the request in Firestore.
 */
let env: RulesTestEnvironment;
const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e";
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function hostPort(variable: string) {
  const [host, port] = process.env[variable]!.split(":");
  return { host, port: Number(port) };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Same project as the emulators so Storage rules can read Firestore.
    projectId: "demo-handy-ceylon",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), ...hostPort("FIRESTORE_EMULATOR_HOST") },
    storage: { rules: readFileSync("storage.rules", "utf8"), ...hostPort("FIREBASE_STORAGE_EMULATOR_HOST") },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "serviceRequests/r1"), {
      customerId: "alice",
      status: "open",
      selectedTechnicianId: null,
      title: "Leaking sink",
    });
    await setDoc(doc(db, "serviceRequests/r1/private/details"), { address: { street: "Temple Road" } });
    await setDoc(doc(db, "serviceRequests/r1/history/e1"), { from: null, to: "open" });
    await uploadBytes(ref(ctx.storage(), "serviceRequests/r1/media/sink.jpg"), jpeg, { contentType: "image/jpeg" });
  });
});

const as = (uid: string, role = "customer") => env.authenticatedContext(uid, { role });

describe("service request documents", () => {
  it("let the owner read their request, private details and history", async () => {
    const db = as("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "serviceRequests/r1")));
    await assertSucceeds(getDoc(doc(db, "serviceRequests/r1/private/details")));
    await assertSucceeds(getDoc(doc(db, "serviceRequests/r1/history/e1")));
  });

  it("hide them from other customers and signed-out visitors", async () => {
    const bob = as("bob").firestore();
    await assertFails(getDoc(doc(bob, "serviceRequests/r1")));
    await assertFails(getDoc(doc(bob, "serviceRequests/r1/private/details")));
    await assertFails(getDoc(doc(bob, "serviceRequests/r1/history/e1")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "serviceRequests/r1")));
  });

  it("show technicians an open request's summary but not its private address", async () => {
    const tech = as("tom", "technician").firestore();
    await assertSucceeds(getDoc(doc(tech, "serviceRequests/r1")));
    await assertFails(getDoc(doc(tech, "serviceRequests/r1/private/details")));
  });

  it("deny every client write, including self-assignment and status changes", async () => {
    const alice = as("alice").firestore();
    await assertFails(
      setDoc(doc(alice, "serviceRequests/r2"), { customerId: "alice", status: "open", selectedTechnicianId: null }),
    );
    await assertFails(updateDoc(doc(alice, "serviceRequests/r1"), { status: "assigned" }));
    await assertFails(updateDoc(doc(alice, "serviceRequests/r1"), { selectedTechnicianId: "alice" }));
    await assertFails(deleteDoc(doc(alice, "serviceRequests/r1")));
    await assertFails(setDoc(doc(alice, "serviceRequests/r1/history/e2"), { from: "open", to: "cancelled" }));

    const tech = as("tom", "technician").firestore();
    await assertFails(updateDoc(doc(tech, "serviceRequests/r1"), { selectedTechnicianId: "tom", status: "assigned" }));
  });
});

describe("request media in Storage", () => {
  const draft = (uid: string, name = "sink.jpg", key = KEY) => `requestMedia/${uid}/${key}/${name}`;

  it("lets customers upload photos and videos to their own draft folder", async () => {
    const storage = as("alice").storage();
    await assertSucceeds(uploadBytes(ref(storage, draft("alice")), jpeg, { contentType: "image/jpeg" }));
    await assertSucceeds(uploadBytes(ref(storage, draft("alice", "leak.mp4")), jpeg, { contentType: "video/mp4" }));
    await assertSucceeds(getBytes(ref(storage, draft("alice"))));
  });

  it("rejects other folders, bad draft ids, wrong types and oversized photos", async () => {
    const storage = as("alice").storage();
    await assertFails(uploadBytes(ref(storage, draft("bob")), jpeg, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(storage, draft("alice", "sink.jpg", "short")), jpeg, { contentType: "image/jpeg" }));
    await assertFails(uploadBytes(ref(storage, draft("alice", "doc.pdf")), jpeg, { contentType: "application/pdf" }));
    await assertFails(
      uploadBytes(ref(storage, draft("alice", "big.jpg")), new Uint8Array(10 * 1024 * 1024 + 1), {
        contentType: "image/jpeg",
      }),
    );
    await assertFails(
      uploadBytes(ref(env.unauthenticatedContext().storage(), draft("alice")), jpeg, { contentType: "image/jpeg" }),
    );
  });

  it("lets only the request's customer read submitted media, and nobody write it", async () => {
    await assertSucceeds(getBytes(ref(as("alice").storage(), "serviceRequests/r1/media/sink.jpg")));
    await assertFails(getBytes(ref(as("bob").storage(), "serviceRequests/r1/media/sink.jpg")));
    await assertFails(
      uploadBytes(ref(as("alice").storage(), "serviceRequests/r1/media/new.jpg"), jpeg, { contentType: "image/jpeg" }),
    );
  });
});

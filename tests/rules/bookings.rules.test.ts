import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/*
 * Get Help Now data is written only by the server. Clients may read what
 * belongs to them; no client can accept a job, change a status or price.
 */
let env: RulesTestEnvironment;

function hostPort(variable: string) {
  const [host, port] = process.env[variable]!.split(":");
  return { host, port: Number(port) };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
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
      status: "assigned",
      selectedTechnicianId: "tom",
      mode: "urgent",
    });
    await setDoc(doc(db, "serviceRequests/r1/offers/tom"), { technicianId: "tom", status: "selected" });
    await setDoc(doc(db, "serviceRequests/r1/offers/tina"), { technicianId: "tina", status: "declined" });
    await setDoc(doc(db, "bookings/b1"), {
      requestId: "r1",
      customerId: "alice",
      technicianId: "tom",
      participantIds: ["alice", "tom"],
      status: "awaiting_customer_approval",
    });
    await setDoc(doc(db, "bookings/b1/statusHistory/e1"), { from: null, to: "technician_assigned" });
    await setDoc(doc(db, "quotations/q1"), {
      bookingId: "b1",
      customerId: "alice",
      technicianId: "tom",
      status: "submitted",
      totalLkr: 5000,
    });
    await uploadBytes(ref(ctx.storage(), "serviceRequests/r1/media/leak.jpg"), new Uint8Array([1, 2, 3]), {
      contentType: "image/jpeg",
    });
  });
});

const as = (uid: string, role = "customer") => env.authenticatedContext(uid, { role });

describe("bookings", () => {
  it("are readable by their customer and technician only", async () => {
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "bookings/b1")));
    await assertSucceeds(getDoc(doc(as("tom", "technician").firestore(), "bookings/b1")));
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "bookings/b1/statusHistory/e1")));
    await assertFails(getDoc(doc(as("bob").firestore(), "bookings/b1")));
    await assertFails(getDoc(doc(as("tina", "technician").firestore(), "bookings/b1")));
    await assertFails(getDoc(doc(as("tina", "technician").firestore(), "bookings/b1/statusHistory/e1")));
  });

  it("can't be created or moved by any client", async () => {
    const tom = as("tom", "technician").firestore();
    const alice = as("alice").firestore();
    await assertFails(updateDoc(doc(tom, "bookings/b1"), { status: "work_in_progress" }));
    await assertFails(updateDoc(doc(alice, "bookings/b1"), { status: "confirmed" }));
    await assertFails(
      setDoc(doc(tom, "bookings/b2"), { customerId: "alice", technicianId: "tom", participantIds: ["alice", "tom"] }),
    );
    await assertFails(setDoc(doc(alice, "bookings/b1/statusHistory/e2"), { from: "inspecting", to: "confirmed" }));
  });
});

describe("quotations", () => {
  it("are readable by the job's customer and technician only", async () => {
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "quotations/q1")));
    await assertSucceeds(getDoc(doc(as("tom", "technician").firestore(), "quotations/q1")));
    await assertFails(getDoc(doc(as("bob").firestore(), "quotations/q1")));
    await assertFails(getDoc(doc(as("tina", "technician").firestore(), "quotations/q1")));
  });

  it("can't be written, approved or repriced by clients", async () => {
    await assertFails(updateDoc(doc(as("alice").firestore(), "quotations/q1"), { status: "accepted" }));
    await assertFails(updateDoc(doc(as("tom", "technician").firestore(), "quotations/q1"), { totalLkr: 9000 }));
    await assertFails(setDoc(doc(as("tom", "technician").firestore(), "quotations/q2"), { bookingId: "b1" }));
  });
});

describe("offers", () => {
  it("are readable by the responding technician and the request's customer", async () => {
    await assertSucceeds(getDoc(doc(as("tom", "technician").firestore(), "serviceRequests/r1/offers/tom")));
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "serviceRequests/r1/offers/tina")));
    await assertFails(getDoc(doc(as("tina", "technician").firestore(), "serviceRequests/r1/offers/tom")));
    await assertFails(getDoc(doc(as("bob").firestore(), "serviceRequests/r1/offers/tom")));
  });

  it("can't be used to accept a job from the client", async () => {
    await assertFails(
      setDoc(doc(as("tina", "technician").firestore(), "serviceRequests/r1/offers/tina"), {
        technicianId: "tina",
        status: "selected",
      }),
    );
    await assertFails(
      updateDoc(doc(as("tina", "technician").firestore(), "serviceRequests/r1"), { selectedTechnicianId: "tina" }),
    );
  });
});

describe("request media", () => {
  it("is readable by the assigned technician but not by other technicians", async () => {
    await assertSucceeds(getBytes(ref(as("tom", "technician").storage(), "serviceRequests/r1/media/leak.jpg")));
    await assertSucceeds(getBytes(ref(as("alice").storage(), "serviceRequests/r1/media/leak.jpg")));
    await assertFails(getBytes(ref(as("tina", "technician").storage(), "serviceRequests/r1/media/leak.jpg")));
  });
});

describe("payments and conversations", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "payments/b1"), {
        bookingId: "b1",
        customerId: "alice",
        technicianId: "tom",
        participantIds: ["alice", "tom"],
        status: "awaiting_completion",
        totalDueLkr: 5000,
      });
      await setDoc(doc(db, "conversations/r1_tom"), { participantIds: ["alice", "tom"], customerId: "alice", technicianId: "tom" });
      await setDoc(doc(db, "conversations/r1_tom/messages/m1"), { senderId: "alice", body: "Hi", attachmentPath: null });
      await setDoc(doc(db, "quotations/q2"), { customerId: "alice", technicianId: "tina", status: "submitted", totalLkr: 4000 });
    });
  });

  it("lets only the job's parties read the payment record, and nobody write it", async () => {
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "payments/b1")));
    await assertSucceeds(getDoc(doc(as("tom", "technician").firestore(), "payments/b1")));
    await assertFails(getDoc(doc(as("bob").firestore(), "payments/b1")));
    await assertFails(updateDoc(doc(as("alice").firestore(), "payments/b1"), { status: "void", totalDueLkr: 0 }));
    await assertFails(updateDoc(doc(as("tom", "technician").firestore(), "payments/b1"), { totalDueLkr: 9000 }));
  });

  it("keeps threads between their two participants", async () => {
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "conversations/r1_tom/messages/m1")));
    await assertSucceeds(getDoc(doc(as("tom", "technician").firestore(), "conversations/r1_tom")));
    await assertFails(getDoc(doc(as("tina", "technician").firestore(), "conversations/r1_tom/messages/m1")));
    await assertFails(getDoc(doc(as("bob").firestore(), "conversations/r1_tom")));
  });

  it("keeps each technician's quotation sealed from other technicians", async () => {
    await assertFails(getDoc(doc(as("tom", "technician").firestore(), "quotations/q2")));
    await assertSucceeds(getDoc(doc(as("tina", "technician").firestore(), "quotations/q2")));
    await assertSucceeds(getDoc(doc(as("alice").firestore(), "quotations/q2")));
  });
});

import { readFileSync } from "node:fs";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-handy-ceylon-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", role: "customer", accountStatus: "active", displayName: "Alice" });
    await setDoc(doc(db, "users/bob"), { uid: "bob", role: "customer", accountStatus: "active", displayName: "Bob" });
    await setDoc(doc(db, "customerProfiles/alice"), { uid: "alice", savedAddresses: [] });
    await setDoc(doc(db, "technicianApplications/alice"), { uid: "alice", applicationStatus: "pending" });
    await setDoc(doc(db, "technicianApplications/bob"), { uid: "bob", applicationStatus: "pending" });
    await setDoc(doc(db, "phoneIndex/+94771234567"), { uid: "alice" });
    await setDoc(doc(db, "technicianProfiles/tech"), {
      uid: "tech",
      verificationStatus: "approved",
      bio: "",
      categoryIds: [],
      serviceDistricts: [],
      availability: "offline",
      ratingAverage: 0,
    });
    await setDoc(doc(db, "serviceCategories/plumbing"), { name: "Plumbing", active: true });
    await setDoc(doc(db, "serviceCategories/retired"), { name: "Retired", active: false });
    await setDoc(doc(db, "services/leak-repair"), { categoryId: "plumbing", active: true });
    await setDoc(doc(db, "services/retired-service"), { categoryId: "plumbing", active: false });
    await setDoc(doc(db, "customerProfiles/alice/addresses/home"), { label: "Home", city: "Kandy" });
    await setDoc(doc(db, "technicianProfiles/suspended-tech"), {
      uid: "suspended-tech",
      verificationStatus: "suspended",
      availability: "offline",
    });
  });
});

const customer = (uid = "alice") => env.authenticatedContext(uid, { role: "customer" }).firestore();
const technician = () => env.authenticatedContext("tech", { role: "technician" }).firestore();
const admin = () => env.authenticatedContext("admin1", { role: "admin" }).firestore();

describe("users", () => {
  it("lets users read only their own account", async () => {
    await assertSucceeds(getDoc(doc(customer(), "users/alice")));
    await assertFails(getDoc(doc(customer(), "users/bob")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice")));
  });

  it("lets admins read any account", async () => {
    await assertSucceeds(getDoc(doc(admin(), "users/bob")));
  });

  it("blocks self-promotion to technician or admin", async () => {
    await assertFails(updateDoc(doc(customer(), "users/alice"), { role: "admin" }));
    await assertFails(updateDoc(doc(customer(), "users/alice"), { role: "technician" }));
    await assertFails(updateDoc(doc(customer(), "users/alice"), { accountStatus: "active" }));
  });

  it("blocks creating an account document from the client", async () => {
    await assertFails(
      setDoc(doc(env.authenticatedContext("mallory").firestore(), "users/mallory"), {
        uid: "mallory",
        role: "admin",
      }),
    );
  });

  it("does not let even admins write accounts from the client", async () => {
    await assertFails(updateDoc(doc(admin(), "users/bob"), { role: "technician" }));
  });
});

describe("customerProfiles", () => {
  it("is readable by its owner only", async () => {
    await assertSucceeds(getDoc(doc(customer(), "customerProfiles/alice")));
    await assertFails(getDoc(doc(customer("bob"), "customerProfiles/alice")));
  });

  it("is never writable from the client", async () => {
    await assertFails(updateDoc(doc(customer(), "customerProfiles/alice"), { savedAddresses: [] }));
  });
});

describe("technicianApplications", () => {
  it("applicants can read their own application, not others'", async () => {
    await assertSucceeds(getDoc(doc(customer(), "technicianApplications/alice")));
    await assertFails(getDoc(doc(customer(), "technicianApplications/bob")));
    await assertFails(getDoc(doc(technician(), "technicianApplications/bob")));
  });

  it("nobody can approve an application from the client", async () => {
    await assertFails(
      updateDoc(doc(customer(), "technicianApplications/alice"), { applicationStatus: "approved" }),
    );
    await assertFails(
      updateDoc(doc(technician(), "technicianApplications/bob"), { applicationStatus: "approved" }),
    );
    await assertFails(
      updateDoc(doc(admin(), "technicianApplications/bob"), { applicationStatus: "approved" }),
    );
  });

  it("applicants cannot create applications directly", async () => {
    await assertFails(
      setDoc(doc(customer("bob"), "technicianApplications/carol"), { applicationStatus: "approved" }),
    );
  });

  it("admins can read applications for review", async () => {
    await assertSucceeds(getDoc(doc(admin(), "technicianApplications/alice")));
  });
});

describe("phoneIndex", () => {
  it("is invisible to clients", async () => {
    await assertFails(getDoc(doc(customer(), "phoneIndex/+94771234567")));
    await assertFails(getDoc(doc(admin(), "phoneIndex/+94771234567")));
  });
});

describe("technicianProfiles", () => {
  it("approved profiles are public", async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), "technicianProfiles/tech")));
  });

  it("technicians edit only their allowed fields", async () => {
    await assertSucceeds(
      updateDoc(doc(technician(), "technicianProfiles/tech"), {
        bio: "Experienced plumber",
        updatedAt: serverTimestamp(),
      }),
    );
    const suspended = env.authenticatedContext("suspended-tech", { role: "technician" }).firestore();
    await assertFails(
      updateDoc(doc(suspended, "technicianProfiles/suspended-tech"), {
        verificationStatus: "approved",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(technician(), "technicianProfiles/tech"), {
        ratingAverage: 5,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("customers cannot create a technician profile for themselves", async () => {
    await assertFails(
      setDoc(doc(customer(), "technicianProfiles/alice"), { uid: "alice", verificationStatus: "approved" }),
    );
  });
});

describe("service catalogue", () => {
  const anon = () => env.unauthenticatedContext().firestore();

  it("active categories and services are public", async () => {
    await assertSucceeds(getDoc(doc(anon(), "serviceCategories/plumbing")));
    await assertSucceeds(getDoc(doc(anon(), "services/leak-repair")));
  });

  it("inactive entries are hidden from everyone but admins", async () => {
    await assertFails(getDoc(doc(anon(), "serviceCategories/retired")));
    await assertFails(getDoc(doc(customer(), "services/retired-service")));
    await assertSucceeds(getDoc(doc(admin(), "serviceCategories/retired")));
  });

  it("only active entries can be listed", async () => {
    await assertSucceeds(getDocs(query(collection(anon(), "serviceCategories"), where("active", "==", true))));
    await assertFails(getDocs(collection(anon(), "serviceCategories")));
  });

  it("nobody can write the catalogue from the client", async () => {
    await assertFails(setDoc(doc(admin(), "serviceCategories/new"), { name: "New", active: true }));
    await assertFails(updateDoc(doc(customer(), "services/leak-repair"), { active: false }));
  });
});

describe("customer addresses", () => {
  it("owners can read their own addresses only", async () => {
    await assertSucceeds(getDoc(doc(customer(), "customerProfiles/alice/addresses/home")));
    await assertFails(getDoc(doc(customer("bob"), "customerProfiles/alice/addresses/home")));
    await assertFails(getDocs(collection(customer("bob"), "customerProfiles/alice/addresses")));
    await assertSucceeds(getDoc(doc(admin(), "customerProfiles/alice/addresses/home")));
  });

  it("addresses cannot be created, edited or deleted from the client", async () => {
    await assertFails(setDoc(doc(customer(), "customerProfiles/alice/addresses/work"), { label: "Work" }));
    await assertFails(updateDoc(doc(customer(), "customerProfiles/alice/addresses/home"), { city: "Galle" }));
    await assertFails(deleteDoc(doc(customer(), "customerProfiles/alice/addresses/home")));
    await assertFails(setDoc(doc(customer("bob"), "customerProfiles/alice/addresses/x"), { label: "Hijack" }));
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { addressInputSchema } from "@/features/addresses/schemas";
import {
  createAddress,
  deleteAddress,
  getAddress,
  getDefaultAddress,
  listAddresses,
  setDefaultAddress,
  snapshotAddress,
  updateAddress,
} from "@/features/addresses/server/repository";
import { signUpSchema } from "@/features/auth/schemas";
import { createCustomerAccount } from "@/features/auth/server/accounts";
import { adminDb } from "@/lib/firebase/admin";

import { resetEmulators, validSignUp } from "./helpers";

beforeEach(resetEmulators);

const address = (overrides: Record<string, unknown> = {}) =>
  addressInputSchema.parse({
    label: "Home",
    recipientName: "Nimal Perera",
    contactNumber: "0771234567",
    houseOrBuilding: "No. 12",
    street: "Temple Road",
    city: "Kandy",
    district: "Kandy",
    postalCode: "20000",
    directions: "",
    latitude: "",
    longitude: "",
    makeDefault: false,
    ...overrides,
  });

async function twoCustomers() {
  const alice = await createCustomerAccount(signUpSchema.parse(validSignUp()));
  const bob = await createCustomerAccount(
    signUpSchema.parse(validSignUp({ email: "bob@example.com", phoneNumber: "0779999999" })),
  );
  return { alice: alice.uid, bob: bob.uid };
}

describe("saved addresses", () => {
  it("creates addresses and makes the first one the default", async () => {
    const { alice } = await twoCustomers();
    const home = await createAddress(alice, address());
    const work = await createAddress(alice, address({ label: "Work", city: "Colombo", district: "Colombo" }));

    const list = await listAddresses(alice);
    expect(list.map((a) => [a.label, a.isDefault])).toEqual([
      ["Home", true],
      ["Work", false],
    ]);
    expect((await getDefaultAddress(alice))?.id).toBe(home);

    await setDefaultAddress(alice, work);
    expect((await getDefaultAddress(alice))?.id).toBe(work);
  });

  it("stores optional coordinates and normalised phone numbers", async () => {
    const { alice } = await twoCustomers();
    const id = await createAddress(alice, address({ latitude: "7.2906", longitude: "80.6337", contactNumber: "081 222 3344" }));
    const saved = await getAddress(alice, id);
    expect(saved?.location).toEqual({ lat: 7.2906, lng: 80.6337 });
    expect(saved?.contactNumber).toBe("+94812223344");
  });

  it("never lets one customer read or change another customer's address", async () => {
    const { alice, bob } = await twoCustomers();
    const aliceHome = await createAddress(alice, address());

    // Bob's session uid scopes every lookup to his own folder.
    expect(await getAddress(bob, aliceHome)).toBeNull();
    await expect(updateAddress(bob, aliceHome, address({ city: "Hijacked" }))).rejects.toThrow("could not be found");
    await expect(deleteAddress(bob, aliceHome)).rejects.toThrow("could not be found");
    await expect(setDefaultAddress(bob, aliceHome)).rejects.toThrow("could not be found");

    expect((await getAddress(alice, aliceHome))?.city).toBe("Kandy");
    expect((await adminDb().collection(`customerProfiles/${bob}/addresses`).get()).size).toBe(0);
  });

  it("promotes another address when the default is deleted", async () => {
    const { alice } = await twoCustomers();
    const home = await createAddress(alice, address());
    const work = await createAddress(alice, address({ label: "Work" }));
    await deleteAddress(alice, home);
    expect((await getDefaultAddress(alice))?.id).toBe(work);
    await deleteAddress(alice, work);
    expect(await getDefaultAddress(alice)).toBeNull();
    expect(await listAddresses(alice)).toEqual([]);
  });

  it("refuses to delete an address used by an active request", async () => {
    const { alice } = await twoCustomers();
    const home = await createAddress(alice, address());
    await adminDb().doc("serviceRequests/r1").set({ customerId: alice, addressId: home, status: "open", bookingId: null });
    await expect(deleteAddress(alice, home)).rejects.toThrow("active request");

    // Once the job is finished the address can go; the request keeps its snapshot.
    await adminDb().doc("bookings/b1").set({ status: "completed" });
    await adminDb().doc("serviceRequests/r1").update({ status: "assigned", bookingId: "b1" });
    await deleteAddress(alice, home);
    expect(await getAddress(alice, home)).toBeNull();
  });

  it("assigned requests with an unfinished booking also lock the address", async () => {
    const { alice } = await twoCustomers();
    const home = await createAddress(alice, address());
    await adminDb().doc("bookings/b2").set({ status: "in_progress" });
    await adminDb().doc("serviceRequests/r2").set({ customerId: alice, addressId: home, status: "assigned", bookingId: "b2" });
    await expect(deleteAddress(alice, home)).rejects.toThrow("active request");
  });

  it("produces a self-contained snapshot for requests", async () => {
    const { alice } = await twoCustomers();
    const home = await createAddress(alice, address({ directions: "Blue gate" }));
    const snapshot = await snapshotAddress(alice, home);
    await updateAddress(alice, home, address({ street: "New Road" }));
    expect(snapshot).toMatchObject({ addressId: home, street: "Temple Road", directions: "Blue gate" });
  });

  it("limits the number of saved addresses", async () => {
    const { alice } = await twoCustomers();
    for (let i = 0; i < 10; i++) await createAddress(alice, address({ label: `Place ${i}` }));
    await expect(createAddress(alice, address({ label: "One too many" }))).rejects.toThrow("up to 10");
  });
});

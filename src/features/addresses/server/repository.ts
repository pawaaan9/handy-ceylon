import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { collections, subcollections } from "@/lib/firestore/collections";
import type { AddressDoc, AddressSnapshot } from "@/lib/firestore/models";
import { UserFacingError } from "@/lib/errors";

import { MAX_ADDRESSES, type AddressInput, type AddressView } from "../schemas";

/**
 * Every function takes the owner's uid from the verified session and only
 * ever touches customerProfiles/{uid}/addresses — another user's address id
 * simply isn't found, so ownership can't be bypassed by guessing ids.
 */
const profileRef = (uid: string) => adminDb().collection(collections.customerProfiles).doc(uid);
const addressesRef = (uid: string) => profileRef(uid).collection(subcollections.addresses);

const NOT_FOUND = "This address could not be found. It may have been deleted.";

function toDoc(input: AddressInput) {
  return {
    label: input.label,
    recipientName: input.recipientName,
    contactNumber: input.contactNumber,
    houseOrBuilding: input.houseOrBuilding,
    street: input.street,
    city: input.city,
    district: input.district,
    postalCode: input.postalCode,
    directions: input.directions,
    location:
      input.latitude !== null && input.longitude !== null
        ? { lat: input.latitude, lng: input.longitude }
        : null,
  } satisfies Omit<AddressDoc, "createdAt" | "updatedAt">;
}

function toView(id: string, data: AddressDoc, defaultId: string | null): AddressView {
  return {
    id,
    label: data.label,
    recipientName: data.recipientName,
    contactNumber: data.contactNumber,
    houseOrBuilding: data.houseOrBuilding,
    street: data.street,
    city: data.city,
    district: data.district,
    postalCode: data.postalCode ?? null,
    directions: data.directions ?? null,
    location: data.location ?? null,
    isDefault: id === defaultId,
  };
}

async function requireProfile(uid: string) {
  const snap = await profileRef(uid).get();
  if (!snap.exists) throw new UserFacingError("Your customer profile could not be found.");
  return snap;
}

export async function listAddresses(uid: string): Promise<AddressView[]> {
  const [profile, snap] = await Promise.all([
    profileRef(uid).get(),
    addressesRef(uid).orderBy("createdAt", "asc").get(),
  ]);
  const defaultId = (profile.get("defaultAddressId") as string | null) ?? null;
  return snap.docs
    .map((d) => toView(d.id, d.data() as AddressDoc, defaultId))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export async function getAddress(uid: string, addressId: string): Promise<AddressView | null> {
  const [profile, snap] = await Promise.all([profileRef(uid).get(), addressesRef(uid).doc(addressId).get()]);
  if (!snap.exists) return null;
  return toView(snap.id, snap.data() as AddressDoc, profile.get("defaultAddressId") ?? null);
}

export async function getDefaultAddress(uid: string): Promise<AddressView | null> {
  const profile = await profileRef(uid).get();
  const defaultId = profile.get("defaultAddressId") as string | null | undefined;
  return defaultId ? getAddress(uid, defaultId) : null;
}

export async function createAddress(uid: string, input: AddressInput): Promise<string> {
  await requireProfile(uid);
  const db = adminDb();
  const ref = addressesRef(uid).doc();

  await db.runTransaction(async (tx) => {
    const [profile, existing] = await Promise.all([
      tx.get(profileRef(uid)),
      tx.get(addressesRef(uid).select().limit(MAX_ADDRESSES)),
    ]);
    if (existing.size >= MAX_ADDRESSES) {
      throw new UserFacingError(`You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`);
    }
    const now = FieldValue.serverTimestamp();
    tx.create(ref, { ...toDoc(input), createdAt: now, updatedAt: now });
    // The first address always becomes the default.
    if (input.makeDefault || !profile.get("defaultAddressId")) {
      tx.update(profileRef(uid), { defaultAddressId: ref.id, updatedAt: now });
    }
  });
  return ref.id;
}

export async function updateAddress(uid: string, addressId: string, input: AddressInput): Promise<void> {
  const db = adminDb();
  const ref = addressesRef(uid).doc(addressId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new UserFacingError(NOT_FOUND);
    const now = FieldValue.serverTimestamp();
    tx.update(ref, { ...toDoc(input), updatedAt: now });
    if (input.makeDefault) tx.update(profileRef(uid), { defaultAddressId: addressId, updatedAt: now });
  });
}

export async function setDefaultAddress(uid: string, addressId: string): Promise<void> {
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(addressesRef(uid).doc(addressId));
    if (!snap.exists) throw new UserFacingError(NOT_FOUND);
    tx.update(profileRef(uid), { defaultAddressId: addressId, updatedAt: FieldValue.serverTimestamp() });
  });
}

/** Booking statuses after which a request no longer needs its address. */
const FINISHED_BOOKING_STATUSES = new Set(["completed", "closed_without_work", "cancelled"]);

/**
 * True while an open request, or a booking that hasn't finished, uses this
 * address. (Requests also keep their own snapshot of the address, so even
 * finished jobs keep a correct record after deletion.)
 */
export async function isAddressInUse(uid: string, addressId: string): Promise<boolean> {
  const db = adminDb();
  const requests = await db
    .collection(collections.serviceRequests)
    .where("customerId", "==", uid)
    .where("addressId", "==", addressId)
    .where("status", "in", ["open", "assigned"])
    .get();
  for (const request of requests.docs) {
    if (request.get("status") === "open") return true;
    const bookingId = request.get("bookingId") as string | null;
    if (!bookingId) return true;
    const booking = await db.collection(collections.bookings).doc(bookingId).get();
    if (!booking.exists || !FINISHED_BOOKING_STATUSES.has(booking.get("status"))) return true;
  }
  return false;
}

export async function deleteAddress(uid: string, addressId: string): Promise<void> {
  const db = adminDb();
  const ref = addressesRef(uid).doc(addressId);
  if (!(await ref.get()).exists) throw new UserFacingError(NOT_FOUND);
  if (await isAddressInUse(uid, addressId)) {
    throw new UserFacingError(
      "This address is used by an active request or booking. You can delete it once that job is finished.",
    );
  }

  await db.runTransaction(async (tx) => {
    const [profile, remaining] = await Promise.all([
      tx.get(profileRef(uid)),
      tx.get(addressesRef(uid).orderBy("updatedAt", "desc").limit(MAX_ADDRESSES + 1)),
    ]);
    if (!remaining.docs.some((d) => d.id === addressId)) throw new UserFacingError(NOT_FOUND);
    tx.delete(ref);
    if (profile.get("defaultAddressId") === addressId) {
      // Promote the most recently updated remaining address, if any.
      const next = remaining.docs.find((d) => d.id !== addressId);
      tx.update(profileRef(uid), {
        defaultAddressId: next?.id ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

/** Copy stored on a service request (Phase 4) so the request survives edits/deletion. */
export async function snapshotAddress(uid: string, addressId: string): Promise<AddressSnapshot> {
  const snap = await addressesRef(uid).doc(addressId).get();
  if (!snap.exists) throw new UserFacingError(NOT_FOUND);
  const data = snap.data() as AddressDoc;
  return {
    addressId,
    label: data.label,
    recipientName: data.recipientName,
    contactNumber: data.contactNumber,
    houseOrBuilding: data.houseOrBuilding,
    street: data.street,
    city: data.city,
    district: data.district,
    postalCode: data.postalCode,
    directions: data.directions,
    location: data.location,
  };
}

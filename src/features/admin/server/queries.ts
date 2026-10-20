import "server-only";

import { AggregateField, type Timestamp } from "firebase-admin/firestore";

import type { BookingMode, BookingStatus, ServiceRequestStatus } from "@/features/bookings/types";
import { finishedBookingStatuses, bookingStatuses } from "@/features/bookings/types";
import type { Urgency } from "@/features/requests/types";
import { adminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firestore/collections";
import type {
  BookingDoc,
  CustomerDoc,
  PaymentDoc,
  ServiceCategoryDoc,
  ServiceDoc,
  ServiceRequestDoc,
  TechnicianDoc,
} from "@/lib/firestore/models";

/**
 * Read-only views for the admin panel. Callers must already have checked the
 * admin role (pages use requireRole(["admin"])). Lists are capped; the panel
 * is for oversight, not bulk export.
 */
const db = () => adminDb();
const iso = (t: unknown) => (t as Timestamp | null | undefined)?.toDate().toISOString() ?? null;
const LIMIT = 300;

async function namesFor(collection: string, uids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const snaps = await db().getAll(...unique.map((uid) => db().collection(collection).doc(uid)));
  return new Map(snaps.filter((s) => s.exists).map((s) => [s.id, (s.get("displayName") as string) ?? s.id]));
}

// ── Overview ────────────────────────────────────────────────────────────────

const activeBookingStatuses = bookingStatuses.filter((s) => !finishedBookingStatuses.includes(s));

export async function getAdminOverview() {
  const count = async (query: FirebaseFirestore.Query) => (await query.count().get()).data().count;
  const [customers, technicians, techniciansOnline, openRequests, activeJobs, completedJobs, due] = await Promise.all([
    count(db().collection(collections.customers)),
    count(db().collection(collections.technicians)),
    count(db().collection(collections.technicians).where("availability", "==", "online")),
    count(db().collection(collections.serviceRequests).where("status", "==", "open")),
    count(db().collection(collections.bookings).where("status", "in", activeBookingStatuses)),
    count(db().collection(collections.bookings).where("status", "==", "completed")),
    db()
      .collection(collections.payments)
      .where("status", "==", "due")
      .aggregate({ count: AggregateField.count(), total: AggregateField.sum("totalDueLkr") })
      .get(),
  ]);
  return {
    customers,
    technicians,
    techniciansOnline,
    openRequests,
    activeJobs,
    completedJobs,
    paymentsDue: due.data().count,
    paymentsDueLkr: due.data().total ?? 0,
  };
}

// ── People ──────────────────────────────────────────────────────────────────

export type AdminTechnicianRow = {
  uid: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  city: string;
  district: string;
  categoryIds: string[];
  serviceDistricts: string[];
  availability: "online" | "offline";
  verificationStatus: TechnicianDoc["verificationStatus"];
  accountStatus: string;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  approvedAt: string | null;
};

export async function listTechnicians(): Promise<AdminTechnicianRow[]> {
  const snap = await db().collection(collections.technicians).limit(LIMIT).get();
  return snap.docs
    .map((d) => {
      const t = d.data() as TechnicianDoc;
      return {
        uid: d.id,
        displayName: t.displayName,
        email: t.email ?? null,
        phoneNumber: t.phoneNumber ?? null,
        city: t.city,
        district: t.district,
        categoryIds: t.categoryIds ?? [],
        serviceDistricts: t.serviceDistricts ?? [],
        availability: t.availability ?? "offline",
        verificationStatus: t.verificationStatus,
        accountStatus: t.accountStatus,
        ratingAverage: t.ratingAverage ?? 0,
        ratingCount: t.ratingCount ?? 0,
        completedJobs: t.completedJobs ?? 0,
        approvedAt: iso(t.approvedAt),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type AdminCustomerRow = {
  uid: string;
  displayName: string;
  email: string | null;
  phoneNumber: string | null;
  accountStatus: string;
  hasDefaultAddress: boolean;
  createdAt: string | null;
};

export async function listCustomers(): Promise<AdminCustomerRow[]> {
  const snap = await db().collection(collections.customers).limit(LIMIT).get();
  return snap.docs
    .map((d) => {
      const c = d.data() as CustomerDoc;
      return {
        uid: d.id,
        displayName: c.displayName,
        email: c.email ?? null,
        phoneNumber: c.phoneNumber ?? null,
        accountStatus: c.accountStatus,
        hasDefaultAddress: Boolean(c.defaultAddressId),
        createdAt: iso(c.createdAt),
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

// ── Operations ──────────────────────────────────────────────────────────────

export type AdminRequestRow = {
  id: string;
  mode: BookingMode;
  status: ServiceRequestStatus;
  bookingStatus: BookingStatus | null;
  bookingId: string | null;
  title: string;
  serviceName: string;
  city: string;
  district: string;
  urgency: Urgency;
  customerName: string;
  offerCount: number;
  quotationCount: number;
  createdAt: string | null;
  expiresAt: string | null;
};

export async function listRequests(): Promise<AdminRequestRow[]> {
  const snap = await db().collection(collections.serviceRequests).orderBy("createdAt", "desc").limit(LIMIT).get();
  const requests = snap.docs.map((d) => ({ id: d.id, r: d.data() as ServiceRequestDoc }));
  const names = await namesFor(collections.customers, requests.map(({ r }) => r.customerId));
  return requests.map(({ id, r }) => ({
    id,
    mode: r.mode,
    status: r.status,
    bookingStatus: r.bookingStatus ?? null,
    bookingId: r.bookingId ?? null,
    title: r.title,
    serviceName: r.catalogue.serviceName,
    city: r.city,
    district: r.district,
    urgency: r.urgency,
    customerName: names.get(r.customerId) ?? "Unknown customer",
    offerCount: r.offerCount ?? 0,
    quotationCount: r.quotationCount ?? 0,
    createdAt: iso(r.createdAt),
    expiresAt: iso(r.expiresAt),
  }));
}

export type AdminJobRow = {
  id: string;
  mode: BookingMode;
  status: BookingStatus;
  title: string;
  serviceName: string;
  city: string;
  district: string;
  customerName: string;
  technicianName: string;
  agreedTotalLkr: number | null;
  inspectionFeeLkr: number;
  updatedAt: string | null;
};

export async function listJobs(): Promise<AdminJobRow[]> {
  const snap = await db().collection(collections.bookings).orderBy("updatedAt", "desc").limit(LIMIT).get();
  const jobs = snap.docs.map((d) => ({ id: d.id, b: d.data() as BookingDoc }));
  const [customers, technicians] = await Promise.all([
    namesFor(collections.customers, jobs.map(({ b }) => b.customerId)),
    namesFor(collections.technicians, jobs.map(({ b }) => b.technicianId)),
  ]);
  return jobs.map(({ id, b }) => ({
    id,
    mode: b.mode,
    status: b.status,
    title: b.summary.title,
    serviceName: b.summary.serviceName,
    city: b.summary.city,
    district: b.summary.district,
    customerName: customers.get(b.customerId) ?? "Unknown customer",
    technicianName: technicians.get(b.technicianId) ?? "Unknown technician",
    agreedTotalLkr: b.agreedTotalLkr,
    inspectionFeeLkr: b.inspectionFeeLkr,
    updatedAt: iso(b.updatedAt),
  }));
}

export type AdminPaymentRow = Pick<PaymentDoc, "status" | "visitFeeLkr" | "repairChargesLkr" | "totalDueLkr"> & {
  bookingId: string;
  customerName: string;
  technicianName: string;
  updatedAt: string | null;
};

export async function listPayments(): Promise<AdminPaymentRow[]> {
  const snap = await db().collection(collections.payments).orderBy("updatedAt", "desc").limit(LIMIT).get();
  const payments = snap.docs.map((d) => d.data() as PaymentDoc);
  const [customers, technicians] = await Promise.all([
    namesFor(collections.customers, payments.map((p) => p.customerId)),
    namesFor(collections.technicians, payments.map((p) => p.technicianId)),
  ]);
  return payments.map((p) => ({
    bookingId: p.bookingId,
    status: p.status,
    visitFeeLkr: p.visitFeeLkr,
    repairChargesLkr: p.repairChargesLkr,
    totalDueLkr: p.totalDueLkr,
    customerName: customers.get(p.customerId) ?? "Unknown customer",
    technicianName: technicians.get(p.technicianId) ?? "Unknown technician",
    updatedAt: iso(p.updatedAt),
  }));
}

// ── Catalogue (including inactive entries, which the public site hides) ─────

export type AdminCategory = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  subcategories: { id: string; name: string; active: boolean }[];
  services: { id: string; name: string; description: string; active: boolean; subcategoryId: string | null }[];
};

export async function loadFullCatalogue(): Promise<AdminCategory[]> {
  const [categories, services] = await Promise.all([
    db().collection(collections.serviceCategories).get(),
    db().collection(collections.services).get(),
  ]);
  const byCategory = new Map<string, AdminCategory["services"]>();
  for (const d of services.docs) {
    const s = d.data() as ServiceDoc;
    const list = byCategory.get(s.categoryId) ?? [];
    list.push({ id: d.id, name: s.name, description: s.description, active: s.active, subcategoryId: s.subcategoryId ?? null });
    byCategory.set(s.categoryId, list);
  }
  return categories.docs
    .map((d) => {
      const c = d.data() as ServiceCategoryDoc;
      return {
        id: d.id,
        name: c.name,
        description: c.description,
        active: c.active,
        sortOrder: c.sortOrder ?? 0,
        subcategories: (c.subcategories ?? []).map((s) => ({ id: s.id, name: s.name, active: s.active })),
        services: (byCategory.get(d.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

import "server-only";

import { createHash } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { snapshotAddress } from "@/features/addresses/server/repository";
import { serviceRequestTransitions } from "@/features/bookings/state-machine";
import { getSelectableService } from "@/features/catalogue/server/repository";
import { isOwnedPath } from "@/features/users/server/profile-photo";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { collections, docIds, storagePaths, subcollections } from "@/lib/firestore/collections";
import type {
  RequestAttachment,
  ServiceRequestDoc,
  ServiceRequestEventDoc,
  ServiceRequestPrivateDoc,
} from "@/lib/firestore/models";
import { UserFacingError } from "@/lib/errors";
import { canTransition } from "@/lib/state-machine";

import {
  attachmentKind,
  validateAttachmentFile,
  type AttachmentInput,
  type CancelServiceRequestInput,
  type CreateServiceRequestInput,
} from "../schemas";
import { MAX_OPEN_REQUESTS, MAX_VIDEOS, requestLifetimeHours } from "../types";
import type { RequestDetailView, RequestSummaryView } from "../views";

/**
 * Service requests are written only here, with the Admin SDK. The customer id
 * always comes from the verified session; status, technician and counters are
 * set by the server and Security Rules deny every client write.
 */
const requestsRef = () => adminDb().collection(collections.serviceRequests);
const privateRef = (requestId: string) =>
  requestsRef().doc(requestId).collection(subcollections.requestPrivate).doc(docIds.requestPrivateDetails);
const historyRef = (requestId: string) =>
  requestsRef().doc(requestId).collection(subcollections.requestHistory);

const NOT_FOUND = "This request could not be found.";

/**
 * Server-derived document id. The same customer + submission key always maps
 * to the same request, so double-clicks and network retries can't create
 * duplicates, and one customer's key can never address another's request.
 */
export function requestIdFor(uid: string, submissionKey: string): string {
  return createHash("sha256").update(`${uid}:${submissionKey}`).digest("base64url").slice(0, 24);
}

/**
 * Re-checks each upload on the server and copies it from the customer's draft
 * folder (which they can still delete) into the request's server-owned folder.
 * Type and size come from the stored object, never from the client. If a
 * concurrent duplicate submission already moved a file, its copy is reused.
 */
async function storeAttachments(
  uid: string,
  submissionKey: string,
  requestId: string,
  inputs: AttachmentInput[],
): Promise<RequestAttachment[]> {
  const bucket = adminStorage().bucket();
  const draftPrefix = storagePaths.requestDraftPrefix(uid, submissionKey);
  const mediaPrefix = storagePaths.requestMediaPrefix(requestId);

  const checked = await Promise.all(
    inputs.map(async (input) => {
      if (!isOwnedPath(input.storagePath, draftPrefix)) {
        throw new UserFacingError(`"${input.name}" can't be used. Please upload it again.`, "attachments");
      }
      const draft = bucket.file(input.storagePath);
      const copy = bucket.file(mediaPrefix + input.storagePath.slice(draftPrefix.length));
      const [draftExists] = await draft.exists();
      const source = draftExists ? draft : (await copy.exists())[0] ? copy : null;
      if (!source) {
        throw new UserFacingError(`"${input.name}" is missing. Please upload it again.`, "attachments");
      }

      const [metadata] = await source.getMetadata();
      const contentType = metadata.contentType ?? "";
      const sizeBytes = Number(metadata.size ?? 0);
      const problem = validateAttachmentFile({ type: contentType, size: sizeBytes });
      if (problem) throw new UserFacingError(`"${input.name}": ${problem}`, "attachments");

      const attachment: RequestAttachment = {
        storagePath: copy.name,
        contentType,
        sizeBytes,
        kind: attachmentKind(contentType)!,
        name: input.name,
      };
      return { attachment, copyFromDraft: source === draft ? () => draft.copy(copy) : null };
    }),
  );

  if (checked.filter((c) => c.attachment.kind === "video").length > MAX_VIDEOS) {
    throw new UserFacingError(`Attach up to ${MAX_VIDEOS} videos.`, "attachments");
  }
  // Copy only once every file has passed.
  await Promise.all(checked.map((c) => c.copyFromDraft?.()));
  return checked.map((c) => c.attachment);
}

/** Creates the request, or returns the one this submission key already created. */
export async function createServiceRequest(
  uid: string,
  input: CreateServiceRequestInput,
): Promise<{ id: string; created: boolean }> {
  const db = adminDb();
  const ref = requestsRef().doc(requestIdFor(uid, input.submissionKey));

  const existing = await ref.get();
  if (existing.exists) return { id: ref.id, created: false };

  const service = await getSelectableService(input.serviceId);
  if (service.categoryId !== input.categoryId) {
    throw new UserFacingError("This service isn't part of the selected category.", "serviceId");
  }
  // Throws "not found" for anyone else's address: it's read from the caller's own folder.
  const address = await snapshotAddress(uid, input.addressId);
  const attachments = await storeAttachments(uid, input.submissionKey, ref.id, input.attachments);

  const created = await db.runTransaction(async (tx) => {
    const [snap, open] = await Promise.all([
      tx.get(ref),
      tx.get(
        requestsRef()
          .where("customerId", "==", uid)
          .where("status", "==", "open")
          .select()
          .limit(MAX_OPEN_REQUESTS),
      ),
    ]);
    if (snap.exists) return false;
    if (open.size >= MAX_OPEN_REQUESTS) {
      throw new UserFacingError(
        `You have ${MAX_OPEN_REQUESTS} open requests. Cancel one or wait for a response before adding another.`,
      );
    }

    const now = FieldValue.serverTimestamp();
    const expiresAt = Timestamp.fromMillis(Date.now() + requestLifetimeHours[input.mode] * 3_600_000);
    tx.create(ref, {
      customerId: uid,
      mode: input.mode,
      status: "open",
      categoryId: service.categoryId,
      serviceId: service.id,
      catalogue: {
        categoryName: service.categoryName,
        serviceName: service.name,
        subcategoryName: service.subcategoryName,
      },
      addressId: input.addressId,
      city: address.city,
      district: address.district,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      preferredSchedule: input.preferredSchedule,
      measurements: input.measurements,
      attachments,
      selectedTechnicianId: null,
      acceptedQuotationId: null,
      bookingId: null,
      offerCount: 0,
      quotationCount: 0,
      cancellation: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    } satisfies Record<keyof ServiceRequestDoc, unknown>);
    tx.create(privateRef(ref.id), {
      address,
      accessInstructions: input.accessInstructions,
    } satisfies ServiceRequestPrivateDoc);
    tx.create(historyRef(ref.id).doc(), {
      from: null,
      to: "open",
      actorId: uid,
      actorRole: "customer",
      note: null,
      at: now,
    } satisfies Record<keyof ServiceRequestEventDoc, unknown>);
    return true;
  });

  // The draft folder is no longer needed (including files removed before submitting).
  await adminStorage()
    .bucket()
    .deleteFiles({ prefix: storagePaths.requestDraftPrefix(uid, input.submissionKey) })
    .catch(() => {});

  return { id: ref.id, created };
}

const iso = (t: unknown) => (t as Timestamp | null | undefined)?.toDate().toISOString() ?? new Date(0).toISOString();

function toSummary(id: string, data: ServiceRequestDoc): RequestSummaryView {
  return {
    id,
    mode: data.mode,
    status: data.status,
    title: data.title,
    categoryName: data.catalogue.categoryName,
    serviceName: data.catalogue.serviceName,
    city: data.city,
    district: data.district,
    urgency: data.urgency,
    preferredSchedule: data.preferredSchedule,
    attachmentCount: data.attachments.length,
    createdAt: iso(data.createdAt),
  };
}

export async function listCustomerRequests(uid: string, limit = 50): Promise<RequestSummaryView[]> {
  const snap = await requestsRef().where("customerId", "==", uid).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => toSummary(d.id, d.data() as ServiceRequestDoc));
}

/** Short-lived links to private request media; null when links can't be signed (e.g. emulators). */
async function attachmentLinks(attachments: RequestAttachment[]) {
  const bucket = adminStorage().bucket();
  return Promise.all(
    attachments.map(async (a) => {
      try {
        const [url] = await bucket.file(a.storagePath).getSignedUrl({
          action: "read",
          expires: Date.now() + 15 * 60 * 1000,
        });
        return { ...a, url };
      } catch {
        return { ...a, url: null };
      }
    }),
  );
}

/** Returns null for missing requests and for requests owned by anyone else. */
export async function getCustomerRequest(uid: string, requestId: string): Promise<RequestDetailView | null> {
  const snap = await requestsRef().doc(requestId).get();
  if (!snap.exists || snap.get("customerId") !== uid) return null;
  const data = snap.data() as ServiceRequestDoc;

  const [privateSnap, historySnap, attachments] = await Promise.all([
    privateRef(requestId).get(),
    historyRef(requestId).orderBy("at", "asc").get(),
    attachmentLinks(data.attachments),
  ]);
  const details = privateSnap.data() as ServiceRequestPrivateDoc | undefined;

  return {
    ...toSummary(snap.id, data),
    categoryId: data.categoryId,
    subcategoryName: data.catalogue.subcategoryName,
    description: data.description,
    measurements: data.measurements,
    address: details?.address ?? null,
    accessInstructions: details?.accessInstructions ?? null,
    attachments,
    cancellation: data.cancellation
      ? {
          by: data.cancellation.by,
          reason: data.cancellation.reason,
          note: data.cancellation.note,
          at: iso(data.cancellation.at),
        }
      : null,
    history: historySnap.docs.map((d) => {
      const e = d.data() as ServiceRequestEventDoc;
      return { from: e.from, to: e.to, actorRole: e.actorRole, note: e.note, at: iso(e.at) };
    }),
    expiresAt: iso(data.expiresAt),
    canCancel: canTransition(serviceRequestTransitions, data.status, "cancelled", "customer"),
  };
}

/** Customer withdraws their own open request; the state machine decides if that's still allowed. */
export async function cancelServiceRequest(uid: string, input: CancelServiceRequestInput): Promise<void> {
  const db = adminDb();
  const ref = requestsRef().doc(input.requestId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("customerId") !== uid) throw new UserFacingError(NOT_FOUND);
    const status = snap.get("status") as ServiceRequestDoc["status"];
    if (!canTransition(serviceRequestTransitions, status, "cancelled", "customer")) {
      throw new UserFacingError("This request can no longer be cancelled.");
    }
    const now = FieldValue.serverTimestamp();
    tx.update(ref, {
      status: "cancelled",
      cancellation: { by: "customer", actorId: uid, reason: input.reason, note: input.note, at: now },
      updatedAt: now,
    });
    tx.create(historyRef(ref.id).doc(), {
      from: status,
      to: "cancelled",
      actorId: uid,
      actorRole: "customer",
      note: input.note,
      at: now,
    } satisfies Record<keyof ServiceRequestEventDoc, unknown>);
  });
}

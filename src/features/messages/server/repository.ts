import "server-only";

import { createHash } from "node:crypto";

import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";
import { collections, subcollections } from "@/lib/firestore/collections";
import type { ConversationDoc, MessageDoc } from "@/lib/firestore/models";
import { UserFacingError } from "@/lib/errors";

import type { MessageView, SendMessageInput } from "../schemas";

/**
 * Customer ↔ technician threads about a request's scope (one per request and
 * responding technician). Only the two participants can read or post; the
 * server writes every message.
 */
const conversationRef = (id: string) => adminDb().collection(collections.conversations).doc(id);
const messagesRef = (id: string) => conversationRef(id).collection(subcollections.messages);

const NOT_FOUND = "This conversation could not be found.";

/** The last 100 messages, oldest first; null if the viewer isn't a participant (or it doesn't exist yet). */
export async function listMessages(viewerUid: string, conversationId: string): Promise<MessageView[] | null> {
  const conversation = await conversationRef(conversationId).get();
  const data = conversation.data() as ConversationDoc | undefined;
  if (!data || !data.participantIds.includes(viewerUid)) return null;
  const snap = await messagesRef(conversationId).orderBy("createdAt", "desc").limit(100).get();
  return snap.docs
    .map((d) => {
      const m = d.data() as MessageDoc;
      return {
        id: d.id,
        mine: m.senderId === viewerUid,
        sender: m.senderId === data.customerId ? ("customer" as const) : ("technician" as const),
        body: m.body,
        at: (m.createdAt as Timestamp | null)?.toDate().toISOString() ?? new Date().toISOString(),
      };
    })
    .reverse();
}

export async function sendMessage(senderUid: string, input: SendMessageInput): Promise<void> {
  const id = createHash("sha256").update(`${input.conversationId}:${senderUid}:${input.clientKey}`).digest("base64url").slice(0, 24);
  await adminDb().runTransaction(async (tx) => {
    const [conversation, existing] = await tx.getAll(conversationRef(input.conversationId), messagesRef(input.conversationId).doc(id));
    const data = conversation.data() as ConversationDoc | undefined;
    if (!data || !data.participantIds.includes(senderUid)) throw new UserFacingError(NOT_FOUND);
    if (existing.exists) return; // retried send
    const now = FieldValue.serverTimestamp();
    tx.create(existing.ref, {
      senderId: senderUid,
      body: input.body,
      attachmentPath: null,
      createdAt: now,
    } satisfies Record<keyof MessageDoc, unknown>);
    tx.update(conversation.ref, { lastMessagePreview: input.body.slice(0, 120), lastMessageAt: now });
  });
}

import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 2000;

export const sendMessageSchema = z.object({
  conversationId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/, "Invalid conversation"),
  /** Per-message key so a retried send doesn't post twice. */
  clientKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid message"),
  body: z
    .string()
    .trim()
    .min(1, "Write a message")
    .max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters`),
});
export type SendMessageInput = z.output<typeof sendMessageSchema>;

export type MessageView = { id: string; mine: boolean; sender: "customer" | "technician"; body: string; at: string };

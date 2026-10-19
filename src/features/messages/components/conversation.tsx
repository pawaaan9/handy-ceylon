"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { MAX_MESSAGE_LENGTH, type MessageView } from "../schemas";
import { sendMessageAction } from "../server/actions";

/**
 * A short thread about the job's scope. Messages are rendered by the server;
 * sending refreshes the page. `otherName` labels the other party.
 */
export function Conversation({
  conversationId,
  messages,
  otherName,
  emptyHint,
}: {
  conversationId: string;
  messages: MessageView[];
  otherName: string;
  emptyHint: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());

  function send() {
    setError(null);
    if (!body.trim()) return setError("Write a message");
    startTransition(async () => {
      const result = await sendMessageAction({ conversationId, clientKey, body }).catch(() => ({
        ok: false as const,
        error: "We couldn't send that. Check your connection and try again.",
      }));
      if (!result.ok) {
        setError(result.error);
        return; // keep the key so a retry can't post twice
      }
      setBody("");
      setClientKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ol className="max-h-80 space-y-2 overflow-y-auto" aria-label={`Messages with ${otherName}`}>
          {messages.map((m) => (
            <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  m.mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                <p className="sr-only">{m.mine ? "You" : otherName}:</p>
                <p className="break-words whitespace-pre-line">{m.body}</p>
                <p className={cn("mt-1 text-[11px]", m.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {formatDateTime(new Date(m.at))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label htmlFor={`msg-${conversationId}`} className="sr-only">
          Message {otherName}
        </label>
        <Textarea
          id={`msg-${conversationId}`}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Message ${otherName} about the job`}
          className="flex-1"
        />
        <Button type="button" size="lg" onClick={send} disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Send data-icon="inline-start" aria-hidden="true" />}
          Send
        </Button>
      </div>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}

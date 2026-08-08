import type { Message } from "@/features/chat/models/chat";

/**
 * Append a user message to the transcript — or, when the assistant is already
 * streaming its reply (identified by `pendingAssistantId`), insert the user's
 * intervention directly ABOVE that reply.
 *
 * Gemini Live can deliver the user's final transcription only after the
 * assistant's response has started streaming (or at turnComplete). Without the
 * insertion, the log would show the avatar's answer first and the user's own
 * words below it. Inserting before the in-flight assistant entry keeps the
 * natural order: the user speaks first, the avatar's reply follows below.
 *
 * Returns a new array; the input is never mutated.
 *
 * Known limitation: if the transcription's `finished` event arrives after the
 * assistant turn already completed (pending id reset), the message is appended
 * below the avatar's entry. Given Gemini Live's event ordering that path is
 * rare — the pending assistant id is still set during the turnComplete flush,
 * which is where most user commits happen.
 */
export function insertUserMessage(
  messages: Message[],
  userMessage: Message,
  pendingAssistantId: string | null
): Message[] {
  if (!pendingAssistantId) return [...messages, userMessage];
  const idx = messages.findIndex((m) => m.id === pendingAssistantId);
  if (idx === -1) return [...messages, userMessage];
  const next = [...messages];
  next.splice(idx, 0, userMessage);
  return next;
}

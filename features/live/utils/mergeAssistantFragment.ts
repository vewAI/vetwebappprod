import type { Message } from "@/features/chat/models/chat";

export type AssistantMergeResult = {
  messages: Message[];
  /** Id of the transcript entry that is currently being accumulated. */
  pendingId: string | null;
  /** Full accumulated text of the current entry. */
  pendingText: string | null;
  /** Next id counter value to use. */
  nextId: number;
};

/**
 * Merge a streaming assistant text fragment into the transcript.
 *
 * Gemini Live streams the output transcription in small fragments; without
 * this, every fragment would become its own message ("out what's", "wrong?")
 * instead of one entry per intervention. Fragments that belong to the same
 * turn (identified by `pendingId`) update that entry's content in place.
 */
export function mergeAssistantFragment(
  messages: Message[],
  fragment: string,
  pendingId: string | null,
  pendingText: string | null,
  persona: { displayName: string; roleKey?: string; portraitUrl?: string; voiceName?: string },
  stageIndex: number,
  nextId: number
): AssistantMergeResult {
  const text = (pendingText ?? "") + fragment;
  const next = [...messages];
  const last = next[next.length - 1];

  if (last && last.role === "assistant" && last.id === pendingId) {
    next[next.length - 1] = { ...last, content: text };
    return { messages: next, pendingId, pendingText: text, nextId };
  }

  const id = `entry_${nextId}`;
  next.push({
    id,
    role: "assistant",
    content: text,
    timestamp: new Date().toISOString(),
    stageIndex,
    displayRole: persona.displayName,
    personaRoleKey: persona.roleKey,
    portraitUrl: persona.portraitUrl,
    voiceId: persona.voiceName,
    status: "sent",
  });
  return { messages: next, pendingId: id, pendingText: text, nextId: nextId + 1 };
}

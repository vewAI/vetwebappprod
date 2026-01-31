export interface Message {
  sender: "user" | "assistant";
  content: string;
  personaRoleKey?: string;
  timestamp?: number;
}

/**
 * Coalesce consecutive messages with the same sender and personaRoleKey.
 * Preserves `personaRoleKey` on the merged message.
 */
export function coalesceMessages(messages: Message[]): Message[] {
  if (!messages || messages.length === 0) return [];

  const out: Message[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (
      last &&
      last.sender === m.sender &&
      last.personaRoleKey === m.personaRoleKey
    ) {
      // merge content, keep existing timestamp
      last.content = `${last.content}\n${m.content}`;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

export default coalesceMessages;

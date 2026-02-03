import type { Message as AppMessage } from "@/features/chat/models/chat";

/**
 * Coalesce consecutive messages with the same role and personaRoleKey.
 * This merges multiple consecutive `user` or `assistant` messages into a single
 * entry to keep the chat history compact.
 */
export function coalesceMessages(messages: AppMessage[]): AppMessage[] {
  if (!messages || messages.length === 0) return [];

  const out: AppMessage[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (
      last &&
      last.role === m.role &&
      (last.personaRoleKey ?? null) === (m.personaRoleKey ?? null)
    ) {
      // merge content with a space separator, preserve last timestamp/status
      last.content = `${last.content}\n${m.content}`.trim();
      // If there is structuredFindings on the newer message, merge keys shallowly
      if (m.structuredFindings) {
        last.structuredFindings = {
          ...(last.structuredFindings || {}),
          ...m.structuredFindings,
        };
      }
      // Prefer the newest portrait/voice info if present
      if (m.portraitUrl) last.portraitUrl = m.portraitUrl;
      if (m.voiceId) last.voiceId = m.voiceId;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

export default coalesceMessages;

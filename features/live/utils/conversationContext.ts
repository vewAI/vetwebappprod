import type { Message } from "@/features/chat/models/chat";

/**
 * Formats the transcript so a freshly connected (or reconnected) Live session
 * can replay it to the model and keep conversational continuity.
 */
export function buildConversationContext(messages: Message[]): string {
  return messages
    .filter((m) => typeof m.content === "string" && m.content.trim() && !m.content.startsWith("[SYS_TRIGGER]"))
    .map((m) => {
      const speaker = m.role === "user" ? "Student" : (m.displayRole ?? "Persona");
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");
}

import type { Message } from "@/features/chat/models/chat";

/**
 * Formats the transcript so a freshly connected (or reconnected) Live session
 * can replay it to the model and keep conversational continuity.
 *
 * `viewerRoleKey` marks which persona is receiving the context: their own
 * past lines are labelled "You" while other participants keep their display
 * role, so the model never role-confuses with other speakers.
 */
export function buildConversationContext(
  messages: Message[],
  opts?: { viewerRoleKey?: string | null }
): string {
  const viewerRoleKey = opts?.viewerRoleKey ?? null;
  return messages
    .filter((m) => typeof m.content === "string" && m.content.trim() && !m.content.startsWith("[SYS_TRIGGER]"))
    .map((m) => {
      let speaker: string;
      if (m.role === "user") {
        speaker = "Student";
      } else if (viewerRoleKey && m.personaRoleKey === viewerRoleKey) {
        speaker = "You";
      } else {
        speaker = m.displayRole ?? "Team member";
      }
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");
}

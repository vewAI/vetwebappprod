import { describe, it, expect } from "vitest";
import { buildConversationContext } from "../conversationContext";
import type { Message } from "@/features/chat/models/chat";

function msg(partial: Partial<Message>): Message {
  return {
    id: partial.id ?? "m1",
    role: partial.role ?? "user",
    content: partial.content ?? "",
    timestamp: partial.timestamp ?? new Date().toISOString(),
    ...partial,
  };
}

describe("buildConversationContext", () => {
  it("formats user and persona turns with role labels", () => {
    const messages = [
      msg({ id: "1", role: "user", content: "Hello, my cow is sick" }),
      msg({
        id: "2",
        role: "assistant",
        content: "Sorry to hear that. When did it start?",
        displayRole: "Client (Horse Owner)",
      }),
    ];
    const result = buildConversationContext(messages);
    expect(result).toBe(
      "Student: Hello, my cow is sick\n\nClient (Horse Owner): Sorry to hear that. When did it start?"
    );
  });

  it("filters empty content and SYS_TRIGGER entries", () => {
    const messages = [
      msg({ id: "1", content: "   " }),
      msg({ id: "2", content: "[SYS_TRIGGER]" }),
      msg({ id: "3", content: "Real question" }),
    ];
    const result = buildConversationContext(messages);
    expect(result).toBe("Student: Real question");
  });

  it("returns an empty string when there is nothing to replay", () => {
    expect(buildConversationContext([])).toBe("");
  });
});

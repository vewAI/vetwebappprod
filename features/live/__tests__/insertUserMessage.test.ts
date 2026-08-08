import assert from "assert";
import { describe, it } from "vitest";
import { insertUserMessage } from "../utils/insertUserMessage";
import type { Message } from "@/features/chat/models/chat";

function makeMessage(id: string, role: "user" | "assistant", content: string): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date().toISOString(),
    stageIndex: 0,
    displayRole: role === "user" ? "You" : "Assistant",
    personaRoleKey: role === "user" ? undefined : "veterinary-nurse",
    status: "sent" as const,
  };
}

describe("insertUserMessage", () => {
  it("appends when no assistant turn is in flight", () => {
    const base = [makeMessage("a1", "assistant", "Hello")];
    const result = insertUserMessage(base, makeMessage("u1", "user", "Hi"), null);

    assert.deepEqual(result.map((m) => m.id), ["a1", "u1"]);
    // input array is never mutated
    assert.deepEqual(base.map((m) => m.id), ["a1"]);
  });

  it("inserts the user message BEFORE the streaming assistant entry", () => {
    const base = [
      makeMessage("a1", "assistant", "Hi, I'm Maria and I brought my dog Max…"),
      makeMessage("a2", "assistant", " because he's been vomiting since yesterday."),
    ];
    const user = makeMessage("u1", "user", "What's wrong with Max?");
    const result = insertUserMessage(base, user, "a2");

    assert.deepEqual(result.map((m) => m.id), ["a1", "u1", "a2"]);
  });

  it("inserts before the right entry even when it is not the last one", () => {
    const base = [
      makeMessage("a1", "assistant", "old turn"),
      makeMessage("u0", "user", "older user"),
      makeMessage("a2", "assistant", "streaming turn"),
    ];
    const user = makeMessage("u1", "user", "new intervention");
    const result = insertUserMessage(base, user, "a2");

    assert.deepEqual(result.map((m) => m.id), ["a1", "u0", "u1", "a2"]);
  });

  it("appends when the pending assistant id is not found in the log", () => {
    const base = [makeMessage("a1", "assistant", "Hello")];
    const result = insertUserMessage(base, makeMessage("u1", "user", "Hi"), "missing-id");

    assert.deepEqual(result.map((m) => m.id), ["a1", "u1"]);
  });
});

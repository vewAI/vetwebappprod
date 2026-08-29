import assert from "assert";
import { describe, it } from "vitest";
import type { Message } from "@/features/chat/models/chat";
import { mergeAssistantFragment } from "../utils/mergeAssistantFragment";

const persona = { displayName: "Helen Kavanagh", roleKey: "owner", voiceName: "Aoede" };

function userMsg(content: string): Message {
  return {
    id: "u1",
    role: "user",
    content,
    timestamp: new Date().toISOString(),
    stageIndex: 0,
    displayRole: "You",
    status: "sent",
  };
}

describe("mergeAssistantFragment", () => {
  it("creates a single entry from many fragments of one turn", () => {
    let messages: Message[] = [];
    let pendingId: string | null = null;
    let pendingText: string | null = null;
    let nextId = 1;

    for (const frag of ["out what's", " wrong?", " more?"]) {
      const res = mergeAssistantFragment(messages, frag, pendingId, pendingText, persona, 0, nextId);
      messages = res.messages;
      pendingId = res.pendingId;
      pendingText = res.pendingText;
      nextId = res.nextId;
    }

    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, "assistant");
    assert.equal(messages[0].content, "out what's wrong? more?");
    assert.equal(messages[0].displayRole, "Helen Kavanagh");
    assert.equal(messages[0].personaRoleKey, "owner");
  });

  it("keeps the same entry id across fragments of the same turn", () => {
    const first = mergeAssistantFragment([], "Hi", null, null, persona, 0, 5);
    const second = mergeAssistantFragment(first.messages, " there", first.pendingId, first.pendingText, persona, 0, first.nextId);
    assert.equal(second.messages.length, 1);
    assert.equal(second.messages[0].id, first.messages[0].id);
  });

  it("starts a new entry after a turn reset (pendingId cleared)", () => {
    const first = mergeAssistantFragment([], "Hello", null, null, persona, 0, 1);
    // Simulate turnComplete: pending refs cleared, entry stays.
    const second = mergeAssistantFragment(first.messages, " again", null, null, persona, 0, first.nextId);
    assert.equal(second.messages.length, 2);
    assert.equal(second.messages[0].content, "Hello");
    // Fragments concatenate verbatim — leading spaces carried by the stream
    // are preserved exactly as sent by Gemini.
    assert.equal(second.messages[1].content, " again");
  });

  it("preserves existing transcript entries before the current turn", () => {
    const base = [userMsg("Hi doctor")];
    const first = mergeAssistantFragment(base, "I", null, null, persona, 1, 1);
    const second = mergeAssistantFragment(first.messages, " am worried", first.pendingId, first.pendingText, persona, 1, first.nextId);
    assert.equal(second.messages.length, 2);
    assert.equal(second.messages[0].content, "Hi doctor");
    assert.equal(second.messages[1].content, "I am worried");
    assert.equal(second.messages[1].stageIndex, 1);
  });
});

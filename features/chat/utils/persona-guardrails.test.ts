import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { ALLOWED_CHAT_PERSONA_KEYS, classifyChatPersonaLabel, isAllowedChatPersonaKey, resolveChatPersonaRoleKey } from "./persona-guardrails";

describe("persona guardrails", () => {
  it("classifies owner style labels", () => {
    assert.equal(classifyChatPersonaLabel("Client (Horse Owner)"), "owner");
    assert.equal(classifyChatPersonaLabel("Producer"), "owner");
  });

  it("classifies nurse style labels", () => {
    assert.equal(classifyChatPersonaLabel("Laboratory Technician"), "veterinary-nurse");
    assert.equal(classifyChatPersonaLabel("Assistant"), "veterinary-nurse");
  });

  it("normalizes directly provided keys", () => {
    assert.equal(classifyChatPersonaLabel("owner"), "owner");
    assert.equal(classifyChatPersonaLabel("Veterinary-Nurse"), "veterinary-nurse");
  });

  it("defaults to nurse when labels are missing", () => {
    assert.equal(resolveChatPersonaRoleKey(undefined, undefined), "veterinary-nurse");
  });

  it("prefers stageRole before displayRole", () => {
    assert.equal(resolveChatPersonaRoleKey("Veterinary Nurse", "Client"), "veterinary-nurse");
  });

  it("confirms allowed persona keys", () => {
    for (const key of ALLOWED_CHAT_PERSONA_KEYS) {
      assert.ok(isAllowedChatPersonaKey(key));
    }
    assert.ok(!isAllowedChatPersonaKey("lab-technician"));
  });
});

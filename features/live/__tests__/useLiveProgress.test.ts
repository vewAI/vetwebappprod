import assert from "assert";
import { describe, it } from "vitest";

import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";
import type { Message } from "@/features/chat/models/chat";

function makeMsg(
  id: string,
  role: "user" | "assistant",
  content: string,
  stageIndex: number
): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
    status: "sent",
  };
}

describe("emitStageEvaluation (used by Live for canAdvance)", () => {
  it("returns insufficient with no messages", () => {
    const result = emitStageEvaluation("case1", 0, []);
    assert.equal(result?.status, "insufficient");
  });

  it("returns insufficient with only 1 user turn and no keywords", () => {
    const messages = [makeMsg("m1", "user", "Hello, how is the patient?", 0)];
    const result = emitStageEvaluation("case1", 0, messages);
    assert.equal(result?.status, "insufficient");
  });

  it("returns ready with enough user turns and keyword hits", () => {
    const messages = [
      makeMsg("m1", "user", "What is the temperature?", 0),
      makeMsg("m2", "user", "Can you check the heart rate?", 0),
      makeMsg("m3", "assistant", "Temperature is 38.5 and pulse is 80", 0),
      makeMsg("m4", "assistant", "Respiratory rate is 24", 0),
    ];
    const result = emitStageEvaluation("case1", 0, messages);
    assert.equal(result?.status, "ready");
    assert.ok(result!.metrics.userTurns >= 2);
    assert.ok(result!.metrics.assistantTurns >= 2);
  });

  it("only counts messages from the current stage", () => {
    const messages = [
      makeMsg("m1", "user", "temperature please", 0),
      makeMsg("m2", "user", "pulse please", 0),
      makeMsg("m3", "assistant", "temps are normal", 0),
      makeMsg("m4", "assistant", "pulse is 80", 0),
      makeMsg("m5", "user", "irrelevant", 1),
      makeMsg("m6", "user", "also irrelevant", 1),
    ];
    const result = emitStageEvaluation("case1", 0, messages);
    assert.equal(result?.status, "ready");
    assert.equal(result!.metrics.userTurns, 2);
  });

  it("handles null caseId gracefully", () => {
    const messages = [makeMsg("m1", "user", "temperature check", 0)];
    const result = emitStageEvaluation(null, 0, messages);
    assert.equal(result?.status, "insufficient");
  });

  it("returns insufficient on exception (invalid inputs)", () => {
    const result = emitStageEvaluation("case1", 0, undefined as any);
    assert.equal(result?.status, "insufficient");
    assert.equal(result.metrics.userTurns, 0);
  });
});

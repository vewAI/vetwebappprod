import { describe, it, expect } from "vitest";
import { emitStageEvaluation } from "@/features/chat/utils/stage-eval";

describe("emitStageEvaluation", () => {
  it("returns insufficient for sparse messages", () => {
    const msgs = [
      { role: "user", content: "hi", stageIndex: 0 },
      { role: "assistant", content: "ok", stageIndex: 0 },
    ] as any;
    const res = emitStageEvaluation("case-1", 0, msgs);
    expect(res.status).toBe("insufficient");
  });

  it("returns ready when thresholds met", () => {
    const msgs = [
      { role: "user", content: "hi", stageIndex: 0 },
      { role: "assistant", content: "Heart rate: 88 bpm", stageIndex: 0 },
      { role: "user", content: "what about lungs", stageIndex: 0 },
      { role: "assistant", content: "Respiratory rate: 20", stageIndex: 0 },
    ] as any;
    const res = emitStageEvaluation("case-1", 0, msgs);
    expect(res.status).toBe("ready");
  });
});

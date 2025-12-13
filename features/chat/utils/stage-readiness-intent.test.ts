import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectStageReadinessIntent,
  type StageReadinessContext,
} from "./stage-readiness-intent";

const baseContext: StageReadinessContext = {
  currentStageTitle: "History Taking",
  nextStageTitle: "Physical Examination",
  nextStageNumber: 2,
  keywordSet: ["physical examination", "physical", "exam"],
  stageIndex: 0,
};

describe("stage readiness intent", () => {
  it("detects explicit stay language", () => {
    const result = detectStageReadinessIntent(
      "I'd like to stay on history a bit longer",
      baseContext,
      { enablePhaseThree: true }
    );
    assert.equal(result.matched, true);
    assert.equal(result.intent, "stay");
  });

  it("detects rollback requests", () => {
    const result = detectStageReadinessIntent(
      "Can we go back to the previous stage for more questions?",
      baseContext,
      { enablePhaseThree: true }
    );
    assert.equal(result.matched, true);
    assert.equal(result.intent, "rollback");
  });

  it("relies on stage keywords for advance intents", () => {
    const result = detectStageReadinessIntent(
      "Let's proceed to the physical examination now",
      baseContext,
      { enablePhaseThree: true }
    );
    assert.equal(result.matched, true);
    assert.equal(result.intent, "advance");
    assert.equal(result.confidence, "high");
  });
});

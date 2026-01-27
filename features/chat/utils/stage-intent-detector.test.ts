import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectStageIntentLegacy,
  detectStageIntentPhase3,
  type StageIntentContext,
} from "./stage-intent-detector";

const legacyContext: StageIntentContext = {
  currentStageTitle: "History Taking",
  nextStageTitle: "Physical Examination",
  nextStageNumber: 2,
  keywordSet: [
    "physical examination",
    "physical",
    "exam",
    "examination",
  ],
};

const ownerContext: StageIntentContext = {
  currentStageTitle: "Physical Examination",
  nextStageTitle: "Owner Follow-up",
  nextStageNumber: 3,
  keywordSet: ["owner", "follow", "client"],
};

describe("stage intent detector", () => {
  it("detects legacy explicit commands", () => {
    const result = detectStageIntentLegacy(
      "Let's move into the physical examination stage",
      legacyContext
    );
    assert.equal(result.matched, true);
    assert.equal(result.confidence, "high");
  });

  it("ignores legacy question prompts", () => {
    const result = detectStageIntentLegacy(
      "What should I cover in the physical examination?",
      legacyContext
    );
    assert.equal(result.matched, false);
  });

  it("allows phase3 persona handoff questions", () => {
    const result = detectStageIntentPhase3(
      "Can I talk to the owner now?",
      ownerContext
    );
    assert.equal(result.matched, true);
    assert.ok(result.heuristics.includes("handoff-request"));
  });

  it("blocks phase3 postpone intent", () => {
    const result = detectStageIntentPhase3(
      "Let's do the physical exam later",
      legacyContext
    );
    assert.equal(result.matched, false);
  });

  it("detects phase3 closing statements", () => {
    const result = detectStageIntentPhase3(
      "I'm finished with history, let's proceed",
      legacyContext
    );
    assert.equal(result.matched, true);
    assert.equal(result.confidence, "medium");
  });

  it("recognizes domain-specific physical exam requests (cardiovascular)", () => {
    const sample = "cardiovascular examine tell me";
    const resLegacy = detectStageIntentLegacy(sample, legacyContext);
    const resPhase3 = detectStageIntentPhase3(sample, legacyContext);
    assert.equal(resLegacy.matched, true, "legacy should match physical exam request");
    assert.equal(resPhase3.matched, true, "phase3 should match physical exam request");
  });
});

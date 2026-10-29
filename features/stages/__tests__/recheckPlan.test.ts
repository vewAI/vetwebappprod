import { describe, expect, it } from "vitest";
import { publicStageSettings, validateRecheckOutcomes, type RecheckOutcome } from "../recheckPlan";

const outcome = (id: string, overrides: Partial<RecheckOutcome> = {}): RecheckOutcome => ({
  id,
  title: `Outcome ${id}`,
  trigger: "Essential treatment given",
  ownerReport: "The horse is eating again.",
  examination: "",
  repeatTests: "",
  feedbackFocus: "",
  ...overrides,
});

describe("recheck authoring plan", () => {
  it("accepts one fixed outcome without a trigger", () => {
    expect(validateRecheckOutcomes([outcome("one", { trigger: "" })])).toBeNull();
  });

  it("requires a trigger and findings for each alternative", () => {
    expect(validateRecheckOutcomes([outcome("one"), outcome("two", { trigger: "" })])).toMatch(/when/);
    expect(validateRecheckOutcomes([outcome("one", { ownerReport: "" })])).toMatch(/finding/);
    expect(validateRecheckOutcomes([outcome("one"), outcome("two", { trigger: "No treatment" })])).toBeNull();
  });

  it("does not send clinical outcome plans to student stage clients", () => {
    expect(publicStageSettings({
      stage_type: "recheck_transition",
      time_limit_seconds: 90,
      recheck_outcomes: [outcome("one")],
      future_map_plan: { monitoringWindow: "24 hours" },
    })).toEqual({ stage_type: "recheck_transition", time_limit_seconds: 90 });
  });
});

export type RecheckOutcome = {
  id: string;
  title: string;
  trigger: string;
  ownerReport: string;
  examination: string;
  repeatTests: string;
  feedbackFocus: string;
};

export type FutureMapPlan = {
  monitoringWindow: string;
  repeatableChecks: string;
  timePattern: string;
  treatmentTiming: string;
  exitConditions: string;
};

export function newRecheckOutcome(title = "Outcome 1"): RecheckOutcome {
  return {
    id: crypto.randomUUID(),
    title,
    trigger: "",
    ownerReport: "",
    examination: "",
    repeatTests: "",
    feedbackFocus: "",
  };
}

export function readRecheckOutcomes(value: unknown): RecheckOutcome[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RecheckOutcome =>
    !!item && typeof item === "object" &&
    typeof item.id === "string" && typeof item.title === "string" &&
    typeof item.trigger === "string" && typeof item.ownerReport === "string" &&
    typeof item.examination === "string" && typeof item.repeatTests === "string" &&
    typeof item.feedbackFocus === "string"
  );
}

export function readFutureMapPlan(value: unknown): FutureMapPlan {
  const plan = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const field = (name: keyof FutureMapPlan) => typeof plan[name] === "string" ? plan[name] as string : "";
  return {
    monitoringWindow: field("monitoringWindow"),
    repeatableChecks: field("repeatableChecks"),
    timePattern: field("timePattern"),
    treatmentTiming: field("treatmentTiming"),
    exitConditions: field("exitConditions"),
  };
}

export function validateRecheckOutcomes(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    return "Add between 1 and 20 outcomes for this recheck";
  }
  const outcomes = readRecheckOutcomes(value);
  if (outcomes.length !== value.length) return "Each outcome needs all of its fields";
  if (new Set(outcomes.map((outcome) => outcome.id)).size !== outcomes.length) {
    return "Outcome IDs must be unique";
  }
  if (outcomes.some((outcome) => !outcome.title.trim())) return "Name each outcome";
  if (outcomes.length > 1 && outcomes.some((outcome) => !outcome.trigger.trim())) {
    return "Describe when each alternative outcome applies";
  }
  if (outcomes.some((outcome) =>
    !outcome.ownerReport.trim() && !outcome.examination.trim() && !outcome.repeatTests.trim()
  )) return "Add at least one patient finding to each outcome";
  return null;
}

export function publicStageSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const publicSettings = { ...value as Record<string, unknown> };
  delete publicSettings.recheck_outcomes;
  delete publicSettings.future_map_plan;
  return publicSettings;
}

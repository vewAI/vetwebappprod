export const STAGE_INTENT_EVENT = "vw:stage-intent" as const;

export type StageIntentEventDetail = {
  attemptId?: string;
  caseId?: string;
  currentStageIndex: number;
  nextStageId?: string;
  nextStageTitle?: string;
  variant: "phase3" | "legacy";
  confidence: "low" | "medium" | "high";
  heuristics?: string[];
  reason?: string;
  messageSample?: string;
};

export function dispatchStageIntentEvent(detail: StageIntentEventDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(STAGE_INTENT_EVENT, { detail }));
  } catch (error) {
    console.warn("Failed to dispatch stage intent event", error);
  }
}

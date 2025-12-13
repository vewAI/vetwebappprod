export const STAGE_READINESS_EVENT = "vw:stage-readiness" as const;

export type StageReadinessEventDetail = {
  attemptId?: string;
  caseId?: string;
  stageIndex: number;
  stageTitle?: string;
  intent: "advance" | "stay" | "rollback";
  confidence: "low" | "medium" | "high";
  heuristics?: string[];
  reason?: string;
  messageSample?: string;
};

export function dispatchStageReadinessEvent(detail: StageReadinessEventDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(STAGE_READINESS_EVENT, { detail }));
  } catch (error) {
    console.warn("Failed to dispatch stage readiness event", error);
  }
}

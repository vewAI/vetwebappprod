import {
  detectStageIntentLegacy,
  detectStageIntentPhase3,
  type StageIntentContext,
} from "./stage-intent-detector";

export type StageReadinessIntent = "advance" | "stay" | "rollback" | "none";

export type StageReadinessContext = StageIntentContext & {
  stageIndex: number;
};

export type StageReadinessDetection = {
  matched: boolean;
  intent: StageReadinessIntent;
  confidence: "low" | "medium" | "high";
  heuristics: string[];
  reason?: string;
};

export type StageReadinessOptions = {
  enablePhaseThree?: boolean;
};

const STAY_PATTERNS: RegExp[] = [
  /\b(stay|remain|keep)\b[^.?!]*(here|stage|section|history)/i,
  /\bnot\s+(yet|right now)\b/i,
  /\b(hold on|wait a second|give me (a )?(moment|minute))\b/i,
  /\bneed (a bit|some|more) time\b/i,
  /\bstill (working|gathering|finishing)\b/i,
];

const ROLLBACK_PATTERNS: RegExp[] = [
  /\bgo back\b[^.?!]*(stage|section|part|history)/i,
  /\bback to\b[^.?!]*(previous|last|prior|history|owner|nurse)/i,
  /\breturn to\b[^.?!]*(history|previous|prior)/i,
  /\brevisit\b[^.?!]*(stage|section|owner|nurse)/i,
  /\bprevious stage\b/i,
  /\bredo\b[^.?!]*(history|exam)/i,
];

const BASE_RESULT: StageReadinessDetection = {
  matched: false,
  intent: "none",
  confidence: "low",
  heuristics: [],
};

const buildStayResult = (reason: string): StageReadinessDetection => ({
  matched: true,
  intent: "stay",
  confidence: "medium",
  heuristics: [reason],
});

const buildRollbackResult = (reason: string): StageReadinessDetection => ({
  matched: true,
  intent: "rollback",
  confidence: "medium",
  heuristics: [reason],
});

export function detectStageReadinessIntent(
  content: string,
  context: StageReadinessContext,
  options: StageReadinessOptions = {}
): StageReadinessDetection {
  if (!content || !content.trim()) {
    return { ...BASE_RESULT };
  }

  for (const pattern of ROLLBACK_PATTERNS) {
    if (pattern.test(content)) {
      return buildRollbackResult("rollback-keyword");
    }
  }

  for (const pattern of STAY_PATTERNS) {
    if (pattern.test(content)) {
      return buildStayResult("stay-keyword");
    }
  }

  const detector = options.enablePhaseThree ? detectStageIntentPhase3 : detectStageIntentLegacy;
  const advanceResult = detector(content, context);
  if (advanceResult.matched) {
    return {
      matched: true,
      intent: "advance",
      confidence: advanceResult.confidence,
      heuristics: ["advance-stage-intent", ...advanceResult.heuristics],
      reason: advanceResult.reason,
    };
  }

  return { ...BASE_RESULT };
}

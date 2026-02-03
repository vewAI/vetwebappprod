export type StageIntentContext = {
  currentStageTitle?: string;
  nextStageTitle?: string;
  nextStageNumber: number;
  keywordSet: string[];
};

export type StageIntentDetectionResult = {
  matched: boolean;
  confidence: "low" | "medium" | "high";
  heuristics: string[];
  reason?: string;
};

import { debugEventBus } from "@/lib/debug-events-fixed";

const DIRECTION_WORDS = [
  "proceed",
  "advance",
  "move",
  "go",
  "continue",
  "switch",
  "jump",
  "head",
  "shift",
  "transition",
  "start",
  "begin",
  "wrap",
  "wrap up",
  "finish",
  "complete",
  "make",
  "run",
  "initiate",
];

const POSTPONE_PATTERN = /\b(later|after|eventually|not yet|hold on|wait|still working)\b/;
const QUESTION_WORD_PATTERN = /\b(what|which|who|where|when|why|how)\b/;
const POLITE_PATTERN = /\b(please|now|ready|let's|lets)\b/;
const NEXT_STAGE_PATTERN = /\bnext\s+(stage|section|part|step)\b/;
const REQUEST_VERB_PATTERN = /\b(talk|speak|hear|connect|bring|get|see)\b/;
const CLOSING_WORD_PATTERN = /\b(done|finished|complete|wrap(?:\s+up)?|conclude|covered|enough)\b/;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeContent(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value?: string) {
  if (!value) return [] as string[];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function sanitizeStagePhrase(value?: string) {
  return tokenize(value).join(" ");
}

function countKeywordHits(normalized: string, keywords: string[]) {
  const hits = new Set<string>();
  keywords.forEach((keyword) => {
    const key = keyword.toLowerCase().trim();
    if (!key || key.length <= 3) return;
    if (normalized.includes(key)) {
      hits.add(key);
    }
  });
  return hits.size;
}

function hasDirectionVerb(normalized: string) {
  return DIRECTION_WORDS.some((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(normalized));
}

function hasStageNumberReference(normalized: string, nextStageNumber: number) {
  return new RegExp(`\\b(stage|section|part|step)\\s*${nextStageNumber}\\b`).test(normalized);
}

function buildClosingRegex(currentStageTitle?: string) {
  const tokens = tokenize(currentStageTitle);
  if (!tokens.length) return null;
  const shortlisted = tokens.filter((token) => token.length >= 4).slice(0, 3);
  if (!shortlisted.length) return null;
  const alternation = shortlisted.map(escapeRegExp).join("|");
  return new RegExp(`${CLOSING_WORD_PATTERN.source}[^?.!]{0,60}\\b(?:${alternation})\\b`);
}

function hasPersonaKeywordMention(normalized: string, keywords: string[]) {
  const personas = keywords.filter((kw) => /owner|client|nurse|technician|assistant|lab|laboratory|diagnostic|results|exam|nurse|producer/.test(kw));
  return personas.some((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(normalized));
}

const noMatch = (): StageIntentDetectionResult => ({
  matched: false,
  confidence: "low",
  heuristics: [],
});

export function detectStageIntentLegacy(content: string, context: StageIntentContext): StageIntentDetectionResult {
  const normalized = normalizeContent(content ?? "");
  if (!normalized) {
    return noMatch();
  }
  if (POSTPONE_PATTERN.test(normalized)) {
    return noMatch();
  }
  if (QUESTION_WORD_PATTERN.test(normalized)) {
    return noMatch();
  }

  const heuristics = new Set<string>();
  const stagePhrase = sanitizeStagePhrase(context.nextStageTitle);
  const stageTokens = stagePhrase ? stagePhrase.split(" ").filter(Boolean) : [];
  const nextKeywords = context.keywordSet.map((kw) => kw.toLowerCase());
  const directionVerb = hasDirectionVerb(normalized);
  if (directionVerb) heuristics.add("direction-verb");
  const mentionsNextStagePhrase = NEXT_STAGE_PATTERN.test(normalized);
  if (mentionsNextStagePhrase) heuristics.add("next-stage-phrase");
  const stageNumberMention = hasStageNumberReference(normalized, context.nextStageNumber);
  if (stageNumberMention) heuristics.add("stage-number");
  const politeCue = POLITE_PATTERN.test(normalized);
  if (politeCue) heuristics.add("polite-cue");
  const stagePhraseRegex = stagePhrase && stagePhrase.length > 0 ? new RegExp(`\\b${escapeRegExp(stagePhrase)}\\b`) : null;
  const keywordMatches = nextKeywords.filter((keyword) => {
    if (!keyword) return false;
    if (keyword.length <= 3) return false;
    return normalized.includes(keyword);
  });
  if (keywordMatches.length) heuristics.add("keyword-hit");
  const richKeywordMatches = keywordMatches.filter((kw) => kw.includes(" ") || kw.length >= 6);
  if (richKeywordMatches.length) heuristics.add("keyword-rich");
  const stageTokenMatches = stageTokens.filter((token) => token.length > 3 && normalized.includes(token));
  if (stageTokenMatches.length) heuristics.add("stage-token-match");
  const mentionsStageKeywords =
    Boolean(stagePhraseRegex?.test(normalized)) ||
    richKeywordMatches.length > 0 ||
    keywordMatches.length >= 2 ||
    stageTokenMatches.length >= Math.min(stageTokens.length, 2);

  const explicitAdvanceToStage = stagePhrase
    ? new RegExp(`\\b(proceed|advance|move|go|switch|jump|head|shift|transition)\\s+(to|into|onto)\\s+${escapeRegExp(stagePhrase)}\\b`).test(
        normalized,
      )
    : false;
  const readyForStagePattern = stagePhrase
    ? new RegExp(`\\b(ready|time|start|begin)\\s+(for|to|with)\\s+${escapeRegExp(stagePhrase)}\\b`).test(normalized)
    : false;
  const letsDoStageRegex =
    stagePhrase && stagePhrase.length > 0
      ? new RegExp(
          `\\blet(?:'s|s| us)?\\s+(?:do|start|begin|perform|move|head|go|transition|switch|make|run|initiate)\\s+(?:to\\s+|into\\s+|with\\s+)?(?:the\\s+|a\\s+)?${escapeRegExp(
            stagePhrase,
          )}\\b`,
        )
      : null;
  const doStageRegex =
    stagePhrase && stagePhrase.length > 0
      ? new RegExp(`\\b(?:do|perform|start|begin|commence|conduct|make|run|initiate)\\s+(?:the\\s+|a\\s+)?${escapeRegExp(stagePhrase)}\\b`)
      : null;
  const reviewStageRegex =
    stagePhrase && stagePhrase.length > 0
      ? new RegExp(
          `\\b(?:let(?:'s|s| us)?\\s+)?(?:see|review|check|look(?:\\s+at)?|view|inspect|go\\s+over|pull\\s+up|show(?:\\s+me)?)\\s+(?:the\\s+|those\\s+|these\\s+)?${escapeRegExp(
            stagePhrase,
          )}\\b`,
        )
      : null;

  const positiveResult = (confidence: "low" | "medium" | "high", reason: string) => {
    const details = { heuristics: Array.from(heuristics), reason, confidence, snippet: normalized.slice(0, 280), context };
    try {
      debugEventBus.emitEvent?.("info", "StageIntent", "detection", details);
    } catch {}
    return {
      matched: true,
      confidence,
      heuristics: Array.from(heuristics),
      reason,
    };
  };

  if (letsDoStageRegex?.test(normalized)) {
    heuristics.add("lets-do-stage");
    return positiveResult("high", "User issued a 'let's do' command for the next stage");
  }
  if (doStageRegex?.test(normalized)) {
    heuristics.add("do-stage-command");
    return positiveResult("high", "User explicitly asked to start the next stage");
  }
  if (reviewStageRegex?.test(normalized)) {
    heuristics.add("review-stage-request");
    return positiveResult("high", "User asked to review the next stage material");
  }
  if (mentionsNextStagePhrase && (directionVerb || politeCue)) {
    return positiveResult("medium", "User referenced the next stage and included a direction verb/polite cue");
  }
  if (stageNumberMention && (directionVerb || politeCue)) {
    return positiveResult("medium", "User referenced the numbered next stage with a direction cue");
  }
  if (explicitAdvanceToStage || readyForStagePattern) {
    heuristics.add("explicit-stage-reference");
    return positiveResult("high", "User explicitly referenced the next stage title");
  }
  if (directionVerb && mentionsStageKeywords) {
    heuristics.add("direction-with-keywords");
    return positiveResult("medium", "User combined direction verbs with stage keywords");
  }
  if (mentionsStageKeywords && politeCue) {
    heuristics.add("keywords-with-polite");
    return positiveResult("medium", "User referenced stage keywords alongside a polite cue");
  }

  // For legacy detection, a single strong physical-exam keyword should be
  // sufficient to indicate intent to perform the Physical Examination stage.
  const isPhysicalStageLegacy = /physical|exam|examination/i.test(context.nextStageTitle ?? "");
  if (isPhysicalStageLegacy && keywordMatches.length >= 1) {
    heuristics.add("physical-single");
    return positiveResult("high", "Single strong physical-exam keyword detected for Physical Examination");
  }

  return noMatch();
}

export function detectStageIntentPhase3(content: string, context: StageIntentContext): StageIntentDetectionResult {
  const normalized = normalizeContent(content ?? "");
  if (!normalized) {
    return noMatch();
  }
  if (POSTPONE_PATTERN.test(normalized)) {
    return noMatch();
  }

  const heuristics = new Set<string>();
  const stagePhrase = sanitizeStagePhrase(context.nextStageTitle);
  const stageTokens = stagePhrase ? stagePhrase.split(" ").filter(Boolean) : [];
  const keywordHits = countKeywordHits(normalized, context.keywordSet);
  if (keywordHits >= 1) heuristics.add("keyword-hit");
  if (keywordHits >= 2) heuristics.add("keyword-pair");
  if (keywordHits >= 3) heuristics.add("keyword-rich");
  const directionVerb = hasDirectionVerb(normalized);
  if (directionVerb) heuristics.add("direction-verb");
  const mentionsNextStagePhrase = NEXT_STAGE_PATTERN.test(normalized);
  if (mentionsNextStagePhrase) heuristics.add("next-stage-phrase");
  const stageNumberMention = hasStageNumberReference(normalized, context.nextStageNumber);
  if (stageNumberMention) heuristics.add("stage-number");
  const politeCue = POLITE_PATTERN.test(normalized);
  if (politeCue) heuristics.add("polite-cue");
  const stagePhraseRegex = stagePhrase && stagePhrase.length > 0 ? new RegExp(`\\b${escapeRegExp(stagePhrase)}\\b`) : null;
  if (stagePhraseRegex?.test(normalized)) {
    heuristics.add("stage-phrase");
  }
  const stageTokenMatches = stageTokens.filter((token) => token.length > 3 && normalized.includes(token)).length;
  if (stageTokenMatches >= Math.min(stageTokens.length, 2)) {
    heuristics.add("stage-token-cluster");
  }

  const closingRegex = buildClosingRegex(context.currentStageTitle);
  const closingCurrentStage = closingRegex?.test(normalized) ?? false;
  if (closingCurrentStage) heuristics.add("close-current-stage");

  const personaMention = hasPersonaKeywordMention(normalized, context.keywordSet);
  if (personaMention) heuristics.add("persona-keyword");
  const handoffRequest = REQUEST_VERB_PATTERN.test(normalized) && personaMention;
  if (handoffRequest) heuristics.add("handoff-request");

  const isQuestion = QUESTION_WORD_PATTERN.test(normalized) || normalized.endsWith("?");
  if (isQuestion && !handoffRequest && !mentionsNextStagePhrase && !stagePhraseRegex?.test(normalized)) {
    return noMatch();
  }

  const matches: Array<{
    confidence: "low" | "medium" | "high";
    reason: string;
    tag: string;
  }> = [];
  const register = (tag: string, condition: boolean, confidence: "low" | "medium" | "high", reason: string) => {
    if (condition) {
      matches.push({ tag, confidence, reason });
    }
  };

  register(
    "explicit-stage-phrase",
    Boolean(stagePhraseRegex?.test(normalized)) && (directionVerb || politeCue),
    "high",
    "User explicitly referenced the next stage title with a directive",
  );
  register("stage-number-cue", stageNumberMention && (directionVerb || politeCue), "high", "User referenced the numbered next stage with a cue");
  register(
    "next-stage-cue",
    mentionsNextStagePhrase && (directionVerb || politeCue),
    "medium",
    "User referenced the term 'next stage' along with a directive",
  );
  register("handoff-request", handoffRequest, "high", "User requested to switch personas (e.g., talk to the owner)");
  register("direction-keywords", directionVerb && keywordHits >= 2, "medium", "User combined a direction verb with multiple stage keywords");

  // Special case: for Physical Examination, a single strong domain keyword
  // (e.g., 'cardiovascular', 'auscultation') is typically enough to indicate
  // the user's intent to perform the exam. Promote these to high confidence.
  const isPhysicalStage = /physical|exam|examination/i.test(context.nextStageTitle ?? "");
  register("physical-single", isPhysicalStage && keywordHits >= 1, "high", "Single strong physical-exam keyword detected for Physical Examination");
  register(
    "closing-current-stage",
    closingCurrentStage && (directionVerb || politeCue),
    "medium",
    "User signaled the current stage is complete and requested to move on",
  );
  register("polite-keywords", keywordHits >= 3 && politeCue, "medium", "User used several stage keywords alongside a polite cue");
  register(
    "token-cluster",
    stageTokenMatches >= 2 && directionVerb,
    "medium",
    "User referenced multiple tokens from the stage title with a directive",
  );

  if (!matches.length) {
    return noMatch();
  }

  const selected = matches.reduce((best, candidate) => {
    const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
    if (!best) return candidate;
    if (confidenceRank[candidate.confidence] > confidenceRank[best.confidence]) {
      return candidate;
    }
    return best;
  }, matches[0]!);

  heuristics.add(selected.tag);

  return {
    matched: true,
    confidence: selected.confidence,
    heuristics: Array.from(heuristics),
    reason: selected.reason,
  };
}

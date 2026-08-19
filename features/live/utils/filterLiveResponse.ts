export type FilteredLiveResponse = {
  text: string;
  suppressed: boolean;
};

// These are model-safety disclaimers, not persona content. Keep the patterns
// deliberately narrow so legitimate clinical dialogue is not discarded.
const DISCLAIMER_PATTERNS: RegExp[] = [
  // "consult a medical/veterinary/healthcare professional"
  /(?:^\s*|[.!?]\s*)(?:someone\s+else,?\s*)?(?:please\s+)?consult\s+(?:a|your|another)\s+(?:medical|veterinary|healthcare)\s+professional(?:\s+(?:or|for)\s+(?:advice|care|attention))?[.!?]?/gi,
  // "see a healthcare/medical professional" / "seek care"
  /(?:^\s*|[.!?]\s*)(?:you\s+should\s+)?(?:always\s+)?(?:see|seek|consult)\s+(?:a|your|another)\s+(?:medical|veterinary|healthcare)\s+professional(?:\s+or\s+seek\s+(?:care|attention))?[.!?]?/gi,
  // "this/that is (not|isn't) medical/veterinary advice"
  /(?:^\s*|[.!?]\s*)(?:this|that)\s+(?:is\s+not|isn't|isn't|ain't)\s+(?:medical|veterinary)\s+advice(?:\s+or\s+(?:a\s+)?diagnosis)?[.!?]?/gi,
  // "I (am|'m) (unable|not able|not equipped) to provide... advice"
  /(?:^\s*|[.!?]\s*)(?:i\s*(?:am|'m|'m)|we\s+are|we're|we're)\s+(?:unable|not able|not equipped)\s+to\s+(?:provide|give|offer)\s+(?:medical|veterinary)?\s*(?:advice|guidance|a diagnosis|diagnoses|treatment recommendations?)[^.!?]*[.!?]?/gi,
  // "I (can't|cannot) provide... advice"
  /(?:^\s*|[.!?]\s*)(?:i\s*(?:can't|cannot|can't))\s+(?:provide|give|offer)\s+(?:medical|veterinary)?\s*(?:advice|guidance|a diagnosis|diagnoses|treatment recommendations?)[^.!?]*[.!?]?/gi,
  // "I (can't|cannot) diagnose"
  /(?:^\s*|[.!?]\s*)(?:i\s*(?:can't|cannot|can't))\s+diagnos(?:e|ing)[^.!?]*[.!?]?/gi,
  // "I'm sorry, there might be a misunderstanding"
  /(?:^\s*|[.!?]\s*)(?:i\s*(?:am|'m|'m)\s+)?(?:so\s+)?sorry,?\s+i\s+think\s+there\s+might\s+be\s+a\s+misunderstanding\s*[.!?…]*/gi,
  // Broad catch: sentence containing "this/that isn't/is not medical advice"
  /(?:^\s*|[.!?]\s*)[^.!?]*(?:this\s+isn't|that\s+isn't|this\s+is\s+not|that\s+is\s+not)\s+(?:medical|veterinary)\s+advice[^.!?]*[.!?]?/gi,
  // Broad catch: "I need to inform you that" + advice disclaimer
  /(?:^\s*|[.!?]\s*)[^.!?]*I\s+need\s+to\s+inform\s+you\s+that[^.!?]*(?:advice|diagnosis|professional)[^.!?]*[.!?]?/gi,
  // Broad catch: "seek care/attention" after a disclaimer phrase
  /(?:^\s*|[.!?]\s*)[^.!?]*seek\s+(?:care|attention|medical\s+help|veterinary\s+care)[^.!?]*[.!?]?/gi,
];

/**
 * Removes common LLM safety boilerplate while retaining the actual persona
 * reply that follows it. If no persona content remains, callers should drop
 * the entire turn, including its audio.
 */
export function filterLivePersonaText(input: string): FilteredLiveResponse {
  let text = input.trim();

  for (const pattern of DISCLAIMER_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  // A common refusal prefix in Live output can leave this fragment behind
  // after the consultation disclaimer is removed.
  text = text.replace(/^\s*someone\s+else\s*,?\s*/i, "");
  text = text
    .replace(/\.{2,}/g, ".")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    text,
    suppressed: text.length === 0,
  };
}

/**
 * Appends a streamed text fragment without duplicating cumulative fragments
 * that some Live API events may repeat across model-turn and transcription
 * payloads.
 */
export function appendLiveTextFragment(current: string, fragment: string): string {
  const next = fragment.trim();
  if (!next) return current;
  if (!current) return next;
  if (current === next || current.endsWith(next)) return current;
  if (next.startsWith(current)) return next;

  const maxOverlap = Math.min(current.length, next.length);
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    if (current.endsWith(next.slice(0, overlap))) {
      return `${current}${next.slice(overlap)}`;
    }
  }

  return `${current} ${next}`.replace(/[ \t]{2,}/g, " ");
}

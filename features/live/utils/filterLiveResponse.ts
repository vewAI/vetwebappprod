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
  /(?:^|[.!?]\s*)[^.!?]*seek\s+(?:care|attention|medical\s+help|veterinary\s+care)[^.!?]*[.!?]?\s*/gi,
  // "seek professional help" (generic — no medical/veterinary qualifier)
  /(?:^|[.!?]\s*)[^.!?]*\bseek\s+professional\s+help\b[^.!?]*[.!?]?\s*/gi,
  // "not a substitute for professional advice/care"
  /(?:^|[.!?]\s*)[^.!?]*\bnot\s+(?:a\s+)?(?:substitute|replacement)\s+for\b[^.!?]*[.!?]?\s*/gi,
  // "reach out to / contact a professional, clinic, vet..."
  /(?:^|[.!?]\s*)[^.!?]*\b(?:reach\s+out\s+to|contact|consult\s+with)\s+(?:a|an|your|the)?\s*(?:professional|veterinar\w*|clinic\w*|expert)[^.!?]*[.!?]?\s*/gi,
  // "recommend seeing/consulting" boilerplate
  /(?:^|[.!?]\s*)[^.!?]*\b(?:i|we)\s+(?:would|'?d)?\s*recommend\s+(?:seeing|consulting|visiting)\b[^.!?]*[.!?]?\s*/gi,
  // "a snapshot in time and not a diagnosis..." style epilogues
  /(?:^|[.!?]\s*)[^.!?]*\bsnapshot\s+in\s+time\b[^.!?]*[.!?]?\s*/gi,
  /(?:^|[.!?]\s*)[^.!?]*\bnot\s+(?:a\s+)?diagnos\w*\b[^.!?]*[.!?]?\s*/gi,
  /(?:^|[.!?]\s*)[^.!?]*\b(?:not|isn'?t)\s+(?:meant|intended)\s+to\s+diagnos\w*[^.!?]*[.!?]?\s*/gi,
  /(?:^|[.!?]\s*)[^.!?]*\b(?:for\s+)?any\s+personal\s+(?:health\s+)?concerns\b[^.!?]*[.!?]?\s*/gi,
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
      const joined = `${current}${next.slice(overlap)}`;
      // When the junction fuses two word characters the overlap was a false
      // positive (e.g. "What will that" + "ell us?" -> "thatell"): prefer a
      // space-separated join so words stay readable.
      const before = joined.charAt(current.length - overlap);
      const after = joined.charAt(current.length - overlap + 1);
      if (overlap <= 2 && /\w/.test(before) && /\w/.test(after)) {
        return `${current} ${next}`.replace(/[ \t]{2,}/g, " ");
      }
      return joined;
    }
  }

  return `${current} ${next}`.replace(/[ \t]{2,}/g, " ");
}

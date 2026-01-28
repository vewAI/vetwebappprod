export type PersonaKey = "owner" | "veterinary-nurse" | null;

export function detectPersonaSwitch(text: string): PersonaKey {
  if (!text) return null;
  const t = text.toLowerCase();
  // owner-related phrases
  const ownerPatterns = [
    /can i talk (to|with) the owner/, /talk (to|with) the owner/, /speak (to|with) the owner/, /talk to owner/, /speak to owner/, /talk with owner/, /speak with owner/, /owner please/, /switch to owner/,
  ];
  for (const p of ownerPatterns) if (p.test(t)) return "owner";

  // nurse-related phrases
  const nursePatterns = [
    // Accept common polite variants and tolerate a frequent ASR mis-transcription 'nose'
    /can i (please )?talk (to|with) (the )?(nurse|nose)/, /may i (please )?talk (to|with) (the )?(nurse|nose)/,
    /talk (to|with) (the )?(nurse|nose)/, /speak (to|with) (the )?(nurse|nose)/, /switch to (the )?(nurse|nose)/,
    /talk to (nurse|nose)/, /speak to (nurse|nose)/, /talk with (nurse|nose)/, /speak with (nurse|nose)/,
  ];
  for (const p of nursePatterns) if (p.test(t)) return "veterinary-nurse";

  return null;
}

export function looksLikeLabRequest(text: string): boolean {
  if (!text) return false;
  return /\b(lab|labs|bloodwork|bloods|blood|cbc|chemistry|biochemistry|hematology|urine|urinalysis|radiograph|x-?ray|xray|imaging|ultrasound|test|tests|results|culture|pcr|serology)\b/i.test(text);
}

// Detect phrases that are explicitly about a physical exam or exam findings so
// we can avoid treating them as lab/test requests (e.g., "results of cardiovascular exam").
export function looksLikePhysicalRequest(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (/\b(exam|examination|physical)\b/.test(t)) return true;
  // common physical exam terms
  const PHYSICAL_TERMS = [
    "cardiovascular",
    "cardiac",
    "heart",
    "pulse",
    "respiratory",
    "breathing",
    "auscultation",
    "lungs",
    "temperature",
    "palpation",
    "rectal",
    "abdominocentesis",
    "auscultate",
    "mucous",
    "mucous membrane",
  ];
  return PHYSICAL_TERMS.some((kw) => t.includes(kw));
}

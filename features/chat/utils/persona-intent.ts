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
    /can i talk (to|with) the nurse/, /talk (to|with) the nurse/, /speak (to|with) the nurse/, /talk to nurse/, /speak to nurse/, /talk with nurse/, /speak with nurse/, /switch to nurse/,
  ];
  for (const p of nursePatterns) if (p.test(t)) return "veterinary-nurse";

  return null;
}

export function looksLikeLabRequest(text: string): boolean {
  if (!text) return false;
  return /\b(lab|labs|bloodwork|bloods|blood|cbc|chemistry|biochemistry|hematology|urine|urinalysis|radiograph|x-?ray|xray|imaging|ultrasound|test|tests|results|culture|pcr|serology)\b/i.test(text);
}

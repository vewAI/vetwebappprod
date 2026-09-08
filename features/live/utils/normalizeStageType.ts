// Case stages may store stage_type values like "physical_exam",
// "Laboratory & Tests" or free text. Map them onto the six canonical types
// used by the gating, intent and guidance logic.
export function normalizeStageType(raw: string | null | undefined): string {
  const s = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  if (/physic|exam|auscult|palpat/.test(s)) return "physical";
  if (/lab|laborator|test|sample|haemat|hemat|chemist|urinalys/.test(s)) return "laboratory";
  if (/diagnos|differential/.test(s)) return "diagnostic";
  if (/treatment|therap|medic/.test(s)) return "treatment";
  if (/history|anamnesis/.test(s)) return "history";
  if (/communication|client|discharge/.test(s)) return "communication";
  return s;
}

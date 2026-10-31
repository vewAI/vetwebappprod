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

// Many cases never set settings.stage_type — infer the canonical type from
// the stage title/description/role text instead. Returns "" when nothing
// matches (callers treat that as "unknown" and fail safely).
// ORDER MATTERS: laboratory titles can have descriptions mentioning diagnostics.
// The laboratory pattern excludes generic "tests", so Diagnostic Planning
// still resolves to diagnostic; history/communication
// signals run last because words like "owner" appear in many descriptions.
export function inferStageTypeFromText(text: string | null | undefined): string {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return "";
  if (/physical|exam|auscult|palpat/.test(t)) return "physical";
  if (/laborator|lab\b|sample|haemat|hemat|chemist|urinalys|blood/.test(t)) return "laboratory";
  if (/diagnos|differential/.test(t)) return "diagnostic";
  if (/treatment|therap|medic|prescri/.test(t)) return "treatment";
  if (/history|anamnesis|interview/.test(t)) return "history";
  if (/communication|client|discharge|explain/.test(t)) return "communication";
  return "";
}

export function resolveLiveStageType(stage: {
  title?: string;
  description?: string;
  settings?: Record<string, unknown>;
} | null | undefined): string {
  if (!stage) return "";
  const raw = typeof stage.settings?.stage_type === "string" ? stage.settings.stage_type : "";
  const storedType = normalizeStageType(raw);
  const titleType = inferStageTypeFromText(stage.title);
  // Older records sometimes label a laboratory stage as "diagnostic".
  if (titleType === "laboratory" && storedType === "diagnostic") return "laboratory";
  return storedType || titleType || inferStageTypeFromText(stage.description);
}

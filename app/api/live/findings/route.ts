import { NextResponse } from "next/server";
import { parseRequestedKeys, PHYS_SYNONYMS } from "@/features/chat/services/physFinder";
import { normalizeStageType } from "@/features/live/utils/normalizeStageType";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";
import {
  getPanelAnalytesFromBundles,
  getDefaultBundledTests,
} from "@/features/personas/utils/bundledTests";

// Diagnostic/lab synonym groups — specific test modalities and panels.
// Generic "labs" is intentionally excluded so asking "what labs do we have?"
// does not match and dump all diagnostic results into the panel.
export const DIAG_SYNONYMS: Record<string, string[]> = {
  bhb: ["beta-hydroxybutyrate", "bhb", "ketone", "ketones"],
  cbc: ["cbc", "complete blood count", "haematology", "hematology", "blood count", "full blood count", "fbc"],
  chem: [
    "chem",
    "chemistry",
    "chemistry panel",
    "blood chemistry",
    "biochem",
    "biochemistry",
    "metabolic panel",
    "serum chemistry",
  ],
  glucose: ["glucose", "blood sugar", "sugar"],
  lactate: ["lactate", "lactic acid"],
  pcv_tpp: ["pcv", "tpp", "packed cell volume", "total protein", "total plasma protein"],
  urinalysis: ["urinalysis", "urine", "urine test", "urine analysis"],
  xray: ["x-ray", "xray", "radiograph", "radiographs", "radiography", "x rays"],
  ultrasound: ["ultrasound", "usg", "echography", "echo", "sonogram"],
  ecg: ["ecg", "ekg", "electrocardiogram", "ecg tracing", "ecg report"],
  calcium: ["calcium", "ca"],
  electrolytes: ["electrolytes", "lytes", "sodium", "potassium", "chloride"],
  blood_gas: ["blood gas", "abg", "vbg", "venous blood gas", "arterial blood gas"],
  coagulation: ["coagulation", "coag", "pt", "aptt", "clotting"],
  cytology: [
    "cytology",
    "peritoneal fluid",
    "abdominocentesis fluid",
    "joint fluid",
    "synovial fluid",
    "tracheal wash",
    "bronchoalveolar",
    "bal",
    "tw",
    "csf",
    "cerebrospinal",
  ],
};

const DEFAULT_BUNDLE_SETS = getPanelAnalytesFromBundles(getDefaultBundledTests());

export const PANEL_ANALYTES: Record<string, Set<string>> = {
  chem: new Set([
    ...Array.from(DEFAULT_BUNDLE_SETS.biochemistry ?? []),
    "potassium", "chloride", "calcium", "glucose", "ast", "ggt", "gldh",
    "creatinine", "bun", "urea", "total protein", "albumin", "globulin",
    "lactate", "bhb", "beta hydroxybutyrate", "nefa", "bicarbonate",
    "sodium", "phosphorus", "phosphate", "magnesium", "alp", "alt",
    "bilirubin", "ck", "cpk", "cholesterol", "triglycerides", "sdma",
    "sdh", "ldh", "lipase", "amylase", "troponin", "blood bhb"
  ]),
  cbc: new Set([
    ...Array.from(DEFAULT_BUNDLE_SETS.haematology ?? []),
    "wbc", "rbc", "platelets", "pcv", "hct", "hematocrit", "haematocrit",
    "haematology", "hematology", "hemoglobin", "haemoglobin", "mcv", "mch",
    "mchc", "rdw", "reticulocytes", "neutrophils", "band neutrophils",
    "segmented neutrophils", "lymphocytes", "monocytes", "eosinophils",
    "basophils", "plt", "thrombocytes", "fibrinogen", "blood smear"
  ]),
  electrolytes: new Set([
    "sodium", "potassium", "chloride", "bicarbonate", "calcium",
    "phosphorus", "phosphate", "magnesium", "anion gap"
  ]),
  coagulation: new Set([
    ...Array.from(DEFAULT_BUNDLE_SETS.coagulation ?? []),
    "coagulation", "coag", "pt", "aptt", "act", "clotting"
  ]),
  urinalysis: new Set([
    ...Array.from(DEFAULT_BUNDLE_SETS.urinalysis ?? []),
    "urine", "urine ketone bodies", "urine ph", "usg", "specific gravity",
    "urine protein", "urine glucose", "urine bilirubin", "urine sediment",
    "sediment", "ketones", "casts", "crystals"
  ]),
  cytology: new Set([
    ...Array.from(DEFAULT_BUNDLE_SETS.peritoneal_fluid ?? []),
    ...Array.from(DEFAULT_BUNDLE_SETS.tracheal_wash ?? []),
    ...Array.from(DEFAULT_BUNDLE_SETS.bronchoalveolar_lavage ?? []),
    ...Array.from(DEFAULT_BUNDLE_SETS.cerebrospinal_fluid ?? []),
    ...Array.from(DEFAULT_BUNDLE_SETS.pleural_fluid ?? []),
    ...Array.from(DEFAULT_BUNDLE_SETS.synovial_fluid ?? []),
  ]),
  ultrasound: new Set([
    "ultrasound", "dorsal findings", "ventral findings", "abomasal position",
    "usg", "echo", "echography", "sonogram"
  ]),
  xray: new Set([
    "xray", "x ray", "radiograph", "radiographs", "radiography"
  ]),
};

export function doesEntryBelongToPanel(
  entryLabel: string,
  panelKey: string,
  category = "",
  customBundles?: Record<string, string[]> | null
): boolean {
  const normLabel = normalizeForMatch(entryLabel);
  const normCat = normalizeForMatch(category);

  if (customBundles && Object.keys(customBundles).length > 0) {
    const customSets = getPanelAnalytesFromBundles(customBundles);
    const customSet = customSets[panelKey];
    if (customSet) {
      for (const a of customSet) {
        if (normLabel === a || normLabel.startsWith(a + " ") || normLabel.endsWith(" " + a)) {
          return true;
        }
      }
    }
  }

  if (panelKey === "chem") {
    if (normCat.includes("chem") || normCat.includes("biochem") || normCat.includes("metabolic")) return true;
    if (normCat.includes("bloodwork") && !PANEL_ANALYTES.cbc?.has(normLabel)) return true;
  }
  if (panelKey === "cbc") {
    if (normCat.includes("cbc") || normCat.includes("haemat") || normCat.includes("hemat")) return true;
    if (normCat.includes("bloodwork") && PANEL_ANALYTES.cbc?.has(normLabel)) return true;
  }
  if (panelKey === "coagulation") {
    if (normCat.includes("coag") || normCat.includes("clotting") || normLabel.includes("coag")) return true;
  }
  if (panelKey === "cytology") {
    if (normCat.includes("fluid") || normCat.includes("cytology") || normCat.includes("wash") || normCat.includes("csf")) return true;
  }
  if (panelKey === "ultrasound") {
    if (normCat.includes("ultrasound") || normCat.includes("usg") || normCat.includes("echo") || normLabel.includes("ultrasound")) return true;
  }
  if (panelKey === "xray") {
    if (normCat.includes("radiograph") || normCat.includes("xray") || normCat.includes("x ray") || normLabel.includes("radiograph") || normLabel.includes("xray")) return true;
  }
  if (panelKey === "urinalysis") {
    if (normCat.includes("urine") || normCat.includes("urinalys") || normLabel.includes("urine")) return true;
  }
  if (panelKey === "electrolytes") {
    if (normCat.includes("electrolyte") || normCat.includes("lyte")) return true;
  }

  const analytes = PANEL_ANALYTES[panelKey];
  if (!analytes) return false;

  for (const a of analytes) {
    if (normLabel === a || normLabel.startsWith(a + " ") || normLabel.endsWith(" " + a)) {
      return true;
    }
  }
  return false;
}

export const GENERIC_CLINICAL_STOPWORDS = new Set([
  "normal", "abnormal", "negative", "positive", "present", "absent",
  "within", "limits", "minute", "minutes", "response", "without",
  "degree", "degrees", "severe", "moderate", "mild", "mildly",
  "bilateral", "bilaterally", "sound", "sounds", "clear", "pressure",
  "noted", "observed", "detected", "findings", "examination", "record",
  "value", "values", "result", "results", "about", "other", "there",
  "which", "where", "these", "those", "their", "after", "before",
  "performed", "evaluated", "checked", "tested", "assessment",
]);

export type FindingItem = {
  key: string;
  label: string;
  value: string;
  source: "physical" | "diagnostic";
};

export type FindingsEntry = { label: string; value: string; category?: string };

export function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    // Collapse British digraphs so "haematology" matches "hemat" stems
    .replace(/ae/g, "e")
    .replace(/oe/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMatchingSynonymKeys(text: string, groups: Record<string, string[]>): Set<string> {
  const matched = new Set<string>();
  const lower = normalizeForMatch(text);
  const textWords = lower.split(" ").filter((w) => w.length >= 4);

  for (const [key, synonyms] of Object.entries(groups)) {
    const hit = synonyms.some((s) => {
      const ns = normalizeForMatch(s);
      if (!ns) return false;
      // Short aliases ("ca", "cbc", "tpp") need whole words; longer ones prefix-match
      if (ns.length <= 3) {
        return new RegExp(`(?:^| )${ns}(?:$| )`).test(lower);
      }
      if (lower.includes(ns)) return true;
      // Stem match: "hemat" ↔ "hematology" (alias starts with the user stem)
      const nsStem = ns.split(" ")[0].slice(0, 5);
      return nsStem.length >= 4 && textWords.some((tw) => nsStem.startsWith(tw) || tw.startsWith(nsStem));
    });
    if (hit) matched.add(key);
  }
  return matched;
}

// A spoken phrase reveals an entry when the full label appears in it, or
// when multiple significant non-generic label words do.
export function labelSpokenIn(label: string, haystack: string): boolean {
  const labelNorm = normalizeForMatch(label);
  if (labelNorm.length < 3) return false;
  if (haystack.includes(labelNorm)) return true;

  const sigWords = labelNorm
    .split(" ")
    .filter((w) => w.length >= 4 && !GENERIC_CLINICAL_STOPWORDS.has(w));
  if (sigWords.length === 0) return false;

  // Single significant word (e.g. "temperature", "pulse"): require whole word in haystack
  if (sigWords.length === 1) {
    const w = sigWords[0];
    return new RegExp(`(?:^| )${w}(?:$| )`).test(haystack);
  }

  // Multi-word label (e.g. "heart rate", "respiratory rate", "mucous membranes"):
  // require at least 2 significant words to match
  const matchedCount = sigWords.filter((w) =>
    new RegExp(`(?:^| )${w}(?:$| )`).test(haystack)
  ).length;
  return matchedCount >= 2 && matchedCount >= Math.ceil(sigWords.length * 0.5);
}

// Inquiries about test availability ("what labs do we have?", "what tests are available?")
// are informational queries that must not reveal findings before the user actually asks for them.
export function isAvailabilityInquiry(text: string): boolean {
  const norm = normalizeForMatch(text);
  const hasQuestionWord = /\b(what|which|do we have|any|are there)\b/.test(norm);
  const hasDiagWord = /\b(labs?|tests?|diagnostics?|results?|bloodwork|bloods)\b/.test(norm);
  const hasAvailabilityWord = /\b(have|available|ready|exist|done|run|there|back)\b/.test(norm);
  const hasActionVerb = /\b(run|order|send|perform|check|show|display|see|view|pull up)\s+(all|the|them|me)\b/.test(norm);
  return hasQuestionWord && hasDiagWord && hasAvailabilityWord && !hasActionVerb;
}

// Requests to see all results ("show all results", "run all tests")
export function isAllLabsRequest(text: string): boolean {
  const norm = normalizeForMatch(text);
  if (/\b(all labs|all lab|all tests|all results|all diagnostic|every test|everything)\b/.test(norm)) {
    return true;
  }
  return /\b(run|order|show|display|get|see|check)\b/.test(norm) && /\b(all|everything)\b/.test(norm);
}

// General requests for "blood work" / "bloods" reveal routine hematology + biochemistry panels
export function isGeneralBloodworkRequest(text: string): boolean {
  const norm = normalizeForMatch(text);
  if (isAvailabilityInquiry(text)) return false;
  return /\b(blood work|bloodwork|bloods|routine bloods)\b/.test(norm);
}

// Stage gating: findings reveal ONLY while the consultation is IN their
// proper stage — physical findings during the Physical Examination stage,
// lab results during Laboratory & Tests. Other stages (History, Diagnostic
// Planning, Treatment, Communication) never reveal. Accumulated entries
// persist in the panel afterwards; unknown/missing types never reveal.
const STAGE_ORDER = ["history", "physical", "diagnostic", "laboratory", "treatment", "communication"];
export function stageAllowsReveal(source: "physical" | "diagnostic", stageType: string): boolean {
  const normalized = normalizeStageType(stageType);
  if (source === "physical") return normalized === "physical";
  return normalized === "laboratory";
}

// Diagnostic records may embed interpretive conclusions (or a full
// diagnostics_summary). Strip them — the student must reach those alone.
function sanitizeDiagnosticText(text: string): string {
  let t = text;
  t = t.replace(/["']?diagnostics_summary["']?\s*:\s*"(?:[^"\\]|\\.)*["']?\s*,?/gi, "");
  t = t.replace(/["']?diagnosis["']?\s*:\s*"(?:[^"\\]|\\.)*["']?\s*,?/gi, "");
  t = t.replace(/[^."'\n]*(?:consistent with|suggestive of|indicat\w+|diagnos\w+)[^."'\n]*\.?/gi, "");
  return t
    .trim()
    .replace(/^[,\s"-]+|[,."\s-]+$/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/["']{2,}/g, '"')
    .trim();
}

function canonicalKeysForLabel(label: string): string[] {
  const normalizedLabel = normalizeForMatch(label);
  const keys: string[] = [];
  for (const [canon, aliases] of Object.entries(PHYS_SYNONYMS)) {
    // Prefix match on the entry label: "Heart Rate" ↔ alias "heart rate" ✓,
    // while "Digital pulses" must NOT match the heart_rate alias "pulse".
    if (aliases.some((a) => normalizedLabel.startsWith(normalizeForMatch(a)))) {
      keys.push(canon);
    }
  }
  return keys;
}

function words(s: string): string[] {
  return normalizeForMatch(s)
    .split(" ")
    .filter((w) => w.length >= 4 && !GENERIC_CLINICAL_STOPWORDS.has(w));
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export const GENERIC_EXAM_WORDS = new Set([
  "rate",
  "rates",
  "exam",
  "examination",
  "test",
  "tests",
  "check",
  "sound",
  "sounds",
  "feel",
  "area",
  "part",
  "side",
  "left",
  "right",
  "body",
  "sign",
  "signs",
  "note",
  "with",
  "from",
  "have",
  "this",
  "that",
  "were",
  "been",
  "will",
  "would",
  "could",
  "should",
  "please",
]);

// Vocabulary match: requires exact match, prefix match of >= 4 chars, or >= 5-char common stem,
// after filtering out generic clinical stopwords and generic exam words.
export function entryMatchesUserText(entryLabel: string, userText: string): boolean {
  const labelWords = words(entryLabel).filter((w) => !GENERIC_EXAM_WORDS.has(w));
  const userWords = words(userText).filter((w) => !GENERIC_EXAM_WORDS.has(w));
  if (labelWords.length === 0 || userWords.length === 0) return false;
  return labelWords.some((lw) =>
    userWords.some((uw) => {
      if (lw === uw) return true;
      if (lw.length >= 4 && uw.length >= 4) {
        if (lw.startsWith(uw) || uw.startsWith(lw)) return true;
      }
      return commonPrefixLength(lw, uw) >= 5;
    })
  );
}

// Extract labelled pairs from JSON-as-text records ("glucose": "3.8 ...").
export function extractLabelledPairs(text: string): FindingsEntry[] {
  const pairs: FindingsEntry[] = [];
  const jsonRe = /["']([a-z0-9_\- ]{2,48})["']\s*:\s*["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonRe.exec(text))) {
    const label = m[1].replace(/_/g, " ").trim();
    const value = m[2].trim();
    if (label) pairs.push({ label, value });
  }
  return pairs;
}

// Findings are stored as "Label: value" entries separated by newlines and/or
// " - " bullets — often ALL inside a single line, or as JSON-as-text. Split
// into granular entries so revealing one match never exposes the whole dataset.
export function extractFindingsEntries(findingsText: string): FindingsEntry[] {
  const text = String(findingsText || "").trim();
  if (!text) return [];
  // JSON-shaped records first (quoted keys are the giveaway).
  if (text.startsWith("{") || /["'][a-z0-9_\- ]{2,48}["']\s*:/.test(text)) {
    const jsonPairs = extractLabelledPairs(text);
    if (jsonPairs.length > 0) return jsonPairs;
  }
  const entries: FindingsEntry[] = [];
  const parts = text.replace(/\r?\n/g, " - ").split(/\s-\s+/);
  for (const partRaw of parts) {
    const part = partRaw.trim().replace(/^-\s*/, "");
    if (!part) continue;
    const colonIdx = part.indexOf(":");
    if (colonIdx > 0 && colonIdx <= 48) {
      entries.push({
        label: part.slice(0, colonIdx).trim(),
        value: part.slice(colonIdx + 1).trim(),
      });
    } else {
      entries.push({ label: part, value: "" });
    }
  }
  return entries;
}

export function capitalizeLabel(label: string): string {
  const clean = label.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function extractDiagPairs(diagText: string): FindingsEntry[] {
  const sanitized = sanitizeDiagnosticText(diagText);
  const entries: FindingsEntry[] = [];

  // 1. Try parsing full JSON if possible
  try {
    const parsed = JSON.parse(sanitized);
    if (typeof parsed === "object" && parsed !== null) {
      function traverse(obj: Record<string, unknown>, parentKey = "") {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            traverse(v as Record<string, unknown>, k);
          } else {
            entries.push({
              label: k.replace(/_/g, " ").trim(),
              value: String(v || "").trim(),
              category: parentKey,
            });
          }
        }
      }
      traverse(parsed);
      if (entries.length > 0) return entries;
    }
  } catch {
    // Not valid JSON, continue with regex/line parsing
  }

  // 2. Regex for JSON-like blocks with category context (e.g. "bloodwork": { ... }, "ultrasound_left_side": { ... })
  const blockRe = /["']([a-z0-9_\- ]{2,48})["']\s*:\s*\{([^}]+)\}/gi;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = blockRe.exec(sanitized))) {
    const parentKey = bMatch[1].replace(/_/g, " ").trim();
    const blockBody = bMatch[2];
    const itemRe = /["']([a-z0-9_\- ]{2,48})["']\s*:\s*["']([^"']*)["']/gi;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = itemRe.exec(blockBody))) {
      entries.push({
        label: iMatch[1].replace(/_/g, " ").trim(),
        value: iMatch[2].trim(),
        category: parentKey,
      });
    }
  }

  // Also extract flat quoted pairs not inside blocks
  const flatItemRe = /["']([a-z0-9_\- ]{2,48})["']\s*:\s*["']([^"']*)["']/gi;
  let fMatch: RegExpExecArray | null;
  while ((fMatch = flatItemRe.exec(sanitized))) {
    const label = fMatch[1].replace(/_/g, " ").trim();
    if (!entries.some((e) => e.label.toLowerCase() === label.toLowerCase())) {
      entries.push({
        label,
        value: fMatch[2].trim(),
        category: "",
      });
    }
  }

  if (entries.length > 0) return entries;

  // 3. Markdown / Pipe tables & Bullet lists
  const lines = sanitized.split(/\r?\n/);
  let currentCategory = "";
  for (const line of lines) {
    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (/test|analyte|parameter/i.test(line)) {
          continue;
        }
        if (/^[-:\s|]+$/.test(line)) continue; // table divider
        if (parts.length >= 3) {
          entries.push({
            label: parts[1],
            value: `${parts[2]} ${parts[3] || ""}`.trim(),
            category: parts[0],
          });
        } else if (parts.length === 2) {
          entries.push({
            label: parts[0],
            value: parts[1],
            category: currentCategory,
          });
        }
      }
    } else {
      const headerMatch = line.match(/^(?:#+\s*|[-*]\s*)?([A-Z\s]{3,25}|CBC|Biochemistry|Haematology|Urinalysis):?$/i);
      if (headerMatch) {
        currentCategory = headerMatch[1].trim();
        continue;
      }
      const parts = line.replace(/\r?\n/g, " - ").split(/\s-\s+/);
      for (const partRaw of parts) {
        const part = partRaw.trim().replace(/^-\s*/, "");
        if (!part) continue;
        const colonIdx = part.indexOf(":");
        if (colonIdx > 0 && colonIdx <= 48) {
          entries.push({
            label: part.slice(0, colonIdx).trim(),
            value: part.slice(colonIdx + 1).trim(),
            category: currentCategory,
          });
        }
      }
    }
  }

  return entries;
}

export function matchDiagnosticFinding(
  entry: FindingsEntry,
  userDiagKeys: Set<string>,
  userText: string,
  isAll: boolean,
  isBloodwork: boolean
): boolean {
  if (isAll) return true;

  const entryDiagKeys = findMatchingSynonymKeys(entry.label, DIAG_SYNONYMS);
  const keyMatch = [...entryDiagKeys].some((k) => userDiagKeys.has(k));
  const panelMatch = [...userDiagKeys].some((pk) => doesEntryBelongToPanel(entry.label, pk, entry.category));
  const vocabMatch = entryMatchesUserText(entry.label, userText);
  const bloodworkMatch =
    isBloodwork &&
    (entryDiagKeys.has("cbc") ||
      entryDiagKeys.has("chem") ||
      entryDiagKeys.has("pcv_tpp") ||
      doesEntryBelongToPanel(entry.label, "chem", entry.category) ||
      doesEntryBelongToPanel(entry.label, "cbc", entry.category));

  return keyMatch || panelMatch || vocabMatch || bloodworkMatch;
}

// Prettify raw record keys ("respiratory_rate" -> "Respiratory Rate").
export function prettifyLabel(label: string): string {
  return capitalizeLabel(String(label || "").replace(/_+/g, " ").trim());
}

// Stored records sometimes contain clarifying questions or prompt fragments
// ("Which specific aspects... do you want to know about?") — never findings.
export function isGarbageEntry(label: string, value: string): boolean {
  const combined = `${label} ${value}`;
  if (label.includes("/") || combined.includes("?")) return true;
  if (/which\s+specific|do you want to know|please (ask|specify)|tell me what/i.test(combined)) return true;
  return false;
}

function cleanValue(value: string): string {
  return String(value || "")
    .replace(/^["'`,.\s-]+/, "")
    .replace(/["'`,\s]+$/, "")
    .trim();
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    if (!(await consumeRateLimit(`live-findings:${auth.user.id}`, 60, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const caseId = typeof body?.caseId === "string" && body.caseId.length <= 200 ? body.caseId : "";
    const userText = typeof body?.userText === "string" ? body.userText.slice(0, 2000) : "";
    const assistantText = typeof body?.assistantText === "string" ? body.assistantText.slice(0, 4000) : "";
    const stageType = typeof body?.stageType === "string" ? body.stageType.slice(0, 60) : "";
    if (!caseId || (!userText.trim() && !assistantText.trim())) {
      return NextResponse.json({ error: "caseId and userText or assistantText are required" }, { status: 400 });
    }

    const { supabase } = auth;
    const { data: caseRow, error } = await supabase
      .from("cases")
      .select("physical_exam_findings, diagnostic_findings")
      .eq("id", caseId)
      .maybeSingle();
    if (error || !caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const physText = typeof caseRow.physical_exam_findings === "string" ? caseRow.physical_exam_findings : "";
    const diagText = typeof caseRow.diagnostic_findings === "string" ? caseRow.diagnostic_findings : "";

    const items: FindingItem[] = [];
    const seen = new Set<string>();

    // 1) Explicit requests: reveal only the entries whose canonical key or
    // vocabulary the user asked for (on-demand, entry-level granularity) and
    // only once their proper stage has been reached.
    const requested = parseRequestedKeys(userText);
    const allowedPhysKeys = new Set(Object.keys(PHYS_SYNONYMS));
    const requestedCanonical = new Set((requested.canonical ?? []).filter((k) => allowedPhysKeys.has(k)));

    const physEntries = extractFindingsEntries(physText);
    const physAllowed = stageAllowsReveal("physical", stageType);

    if (physAllowed && (requestedCanonical.size > 0 || userText.trim())) {      for (const entry of physEntries) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const entryKeys = canonicalKeysForLabel(entry.label);
        const canonicalHit = entryKeys.some((k) => requestedCanonical.has(k));
        const vocabHit = entryMatchesUserText(entry.label, userText);
        if (!canonicalHit && !vocabHit) continue;
        const dedupeKey = `phys:${normalizeForMatch(entry.label)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: prettifyLabel(entry.label),
          value: cleanValue(entry.value) || prettifyLabel(entry.label),
          source: "physical",
        });
      }
    }

    // 2) What the persona verbalized: reveal entries whose label appears in
    // the persona's spoken reply, so the panel mirrors the conversation.
    // Guard against assistant asking questions rather than reporting findings.
    const isAssistantAsking =
      assistantText.includes("?") ||
      /\b(would you like|do you want|shall i|which (test|one|panel|system)|should i|we can run|we have .* ready)\b/i.test(assistantText);

    const haystack = normalizeForMatch(assistantText);
    // DISABLED: assistant-text-based reveal removed to prevent unrequested findings from appearing in the panel. Only student-requested findings should show.
    /*
    if (physAllowed && haystack && !isAssistantAsking) {
      for (const entry of physEntries) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !labelSpokenIn(entry.label, haystack)) continue;
        const dedupeKey = `phys:${labelNorm}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: prettifyLabel(entry.label),
          value: cleanValue(entry.value) || prettifyLabel(entry.label),
          source: "physical",
        });
      }
    }
    */

    // 3) Diagnostic/lab values: reveal ONLY the entries matching a test the
    // student explicitly requested (once the laboratory phase is reached).
    // Interpretive content is stripped — conclusions are the student's job.
    // Entries come back individually so the panel can render them as a table.
    const diagAllowed = stageAllowsReveal("diagnostic", stageType);
    const diagEntries = diagAllowed && diagText ? extractDiagPairs(diagText) : [];

    if (diagAllowed && diagEntries.length > 0) {
      const isAll = isAllLabsRequest(userText);
      const isAvail = isAvailabilityInquiry(userText);
      const isBloodwork = isGeneralBloodworkRequest(userText);
      const userDiagKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);

      // Only evaluate explicit request if it is not an inquiry about availability,
      // or if specific test keys were mentioned despite inquiry phrasing
      const shouldEvaluateUserRequest = isAll || isBloodwork || userDiagKeys.size > 0 || (!isAvail && userText.trim().length > 0);

      if (shouldEvaluateUserRequest) {
        for (const entry of diagEntries) {
          if (isGarbageEntry(entry.label, entry.value)) continue;

          const hit = matchDiagnosticFinding(entry, userDiagKeys, userText, isAll, isBloodwork);
          if (!hit) continue;

          const labelNorm = normalizeForMatch(entry.label);
          if (!labelNorm) continue;
          const dedupeKey = `diag:${labelNorm}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          items.push({
            key: dedupeKey,
            label: capitalizeLabel(entry.label),
            value: cleanValue(entry.value) || entry.label,
            source: "diagnostic",
          });
        }
      }
    }

    // 4) Lab values the persona verbalized: during the laboratory phase when the
    // nurse states findings — each spoken entry lands in the panel live.
    // Ignore if the assistant is merely asking a question or offering options.
    // DISABLED: assistant-text-based reveal removed to prevent unrequested findings from appearing in the panel. Only student-requested findings should show.
    /*
    if (diagAllowed && diagEntries.length > 0 && haystack && !isAssistantAsking) {
      for (const entry of diagEntries) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !labelSpokenIn(entry.label, haystack)) continue;
        const dedupeKey = `diag:${labelNorm}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: prettifyLabel(entry.label),
          value: cleanValue(entry.value) || prettifyLabel(entry.label),
          source: "diagnostic",
        });
      }
    }
    */

    console.log("[live/findings]", { stageType: normalizeStageType(stageType), revealed: items.length });
    console.log(
      "[live/findings]",
      JSON.stringify({
        stageTypeRaw: stageType,
        stageType: normalizeStageType(stageType),
        physEntries: physEntries.length,
        physTextLength: physText.length,
        physAllowed,
        diagAllowed,
        revealed: items.length,
      })
    );
    return NextResponse.json({
      items,
      debug: {
        stageType: normalizeStageType(stageType),
        physEntries: physEntries.length,
        physAllowed,
        diagAllowed,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Live findings lookup failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { parseRequestedKeys, PHYS_SYNONYMS } from "@/features/chat/services/physFinder";
import { normalizeStageType } from "@/features/live/utils/normalizeStageType";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

// Diagnostic/lab synonym groups — kept in sync with the map in
// app/api/chat/route.ts (DIAG_SYNONYMS).
const DIAG_SYNONYMS: Record<string, string[]> = {
  bhb: ["beta-hydroxybutyrate", "bhb", "ketone", "ketones"],
  cbc: ["cbc", "complete blood count", "haematology", "hematology"],
  chem: ["chem", "chemistry", "chemistry panel", "blood chemistry"],
  glucose: ["glucose", "blood sugar", "sugar"],
  urinalysis: ["urinalysis", "urine"],
  xray: ["x-ray", "xray", "radiograph", "radiographs"],
  ultrasound: ["ultrasound", "usg", "echography", "echo"],
  ecg: ["ecg", "ecg tracing", "ecg report"],
  calcium: ["calcium", "ca"],
};

type FindingItem = {
  key: string;
  label: string;
  value: string;
  source: "physical" | "diagnostic";
};

type FindingsEntry = { label: string; value: string };

function normalizeForMatch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    // Collapse British digraphs so "haematology" matches "hemat" stems
    .replace(/ae/g, "e")
    .replace(/oe/g, "e")
    .replace(/\s+/g, " ")
    .trim();
}

function findSynonymKey(text: string, groups: Record<string, string[]>): string | null {
  const lower = normalizeForMatch(text);
  const textWords = lower.split(" ").filter((w) => w.length >= 4);
  for (const [key, synonyms] of Object.entries(groups)) {
    const hit = synonyms.some((s) => {
      const ns = normalizeForMatch(s);
      if (!ns) return false;
      // Short aliases ("ca") need whole words; longer ones prefix-match
      if (ns.length <= 3) {
        return new RegExp(`(?:^| )${ns}(?:$| )`).test(lower);
      }
      if (lower.includes(ns)) return true;
      // Stem match: "hemat" ↔ "hematology" (alias starts with the user stem)
      const nsStem = ns.split(" ")[0].slice(0, 5);
      return nsStem.length >= 4 && textWords.some((tw) => nsStem.startsWith(tw));
    });
    if (hit) return key;
  }
  return null;
}

// A spoken phrase reveals an entry when the full label appears in it, or
// when any significant label word does ("respirations are 28" — "Resp Rate").
function labelSpokenIn(label: string, haystack: string): boolean {
  const labelNorm = normalizeForMatch(label);
  if (labelNorm.length >= 3 && haystack.includes(labelNorm)) return true;
  return labelNorm
    .split(" ")
    .some((w) => w.length >= 5 && haystack.includes(w));
}

// Stage gating: findings reveal ONLY while the consultation is IN their
// proper stage — physical findings during the Physical Examination stage,
// lab results during Laboratory & Tests. Other stages (History, Diagnostic
// Planning, Treatment, Communication) never reveal. Accumulated entries
// persist in the panel afterwards; unknown/missing types never reveal.
const STAGE_ORDER = ["history", "physical", "diagnostic", "laboratory", "treatment", "communication"];
function stageAllowsReveal(source: "physical" | "diagnostic", stageType: string): boolean {
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
  return normalizeForMatch(s).split(" ").filter((w) => w.length >= 4);
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Fuzzy vocabulary match: "musculoskeletal" ↔ "Muscle palpation" share the
// 5-char stem "muscl"; "temp" is a prefix of "temperature". Requires a
// ≥5-char common prefix so generic words never match.
function entryMatchesUserText(entryLabel: string, userText: string): boolean {
  const labelWords = words(entryLabel);
  const userWords = words(userText);
  if (labelWords.length === 0 || userWords.length === 0) return false;
  return labelWords.some((lw) =>
    userWords.some((uw) => commonPrefixLength(lw, uw) >= 4)
  );
}

// Diagnostic entries match when the student names the test group OR uses
// vocabulary sharing a ≥5-char stem with the entry label ("biochemistry
// values" ↔ "Glucose"/"Creatinine" rows).
function entryMatchesUserTextDiag(userText: string, diagText: string): boolean {
  const userWords = words(userText);
  if (userWords.length === 0) return false;
  return extractDiagPairs(diagText).some((entry) =>
    words(entry.label).some((lw) =>
      userWords.some((uw) => commonPrefixLength(lw, uw) >= 4)
    )
  );
}

// Extract labelled pairs from JSON-as-text records ("glucose": "3.8 ...").
function extractLabelledPairs(text: string): FindingsEntry[] {
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
function extractFindingsEntries(findingsText: string): FindingsEntry[] {
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

function capitalizeLabel(label: string): string {
  const clean = label.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function extractDiagPairs(diagText: string): FindingsEntry[] {
  const text = sanitizeDiagnosticText(diagText);
  const pairs = extractLabelledPairs(text);
  if (pairs.length > 0) return pairs;
  return extractFindingsEntries(text);
}

// Prettify raw record keys ("respiratory_rate" -> "Respiratory Rate").
function prettifyLabel(label: string): string {
  return capitalizeLabel(String(label || "").replace(/_+/g, " ").trim());
}

// Stored records sometimes contain clarifying questions or prompt fragments
// ("Which specific aspects... do you want to know about?") — never findings.
function isGarbageEntry(label: string, value: string): boolean {
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
    const haystack = normalizeForMatch(assistantText);
    if (physAllowed && haystack) {      for (const entry of physEntries) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !labelSpokenIn(labelNorm, haystack)) continue;
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

    // 3) Diagnostic/lab values: reveal ONLY the entries matching a test the
    // student explicitly named (once the laboratory phase is reached).
    // Interpretive content is stripped — conclusions are the student's job.
    // Entries come back individually so the panel can render them as a table.
    const diagAllowed = stageAllowsReveal("diagnostic", stageType);
    const diagKey = diagAllowed ? findSynonymKey(userText, DIAG_SYNONYMS) : null;
    const vocabDiag = diagAllowed && entryMatchesUserTextDiag(userText, diagText);

    if (diagAllowed && diagText && (diagKey || vocabDiag)) {
      // A named group or vocabulary match reveals the whole sanitized
      // diagnostic panel — the data is not tagged per sub-panel, and the
      // student asked for it. Filter only garbage (questions/prompts).
      for (const entry of extractDiagPairs(diagText)) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const labelNorm = normalizeForMatch(entry.label);
        if (!labelNorm) continue;
        const dedupeKey = `diag:${labelNorm}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: capitalizeLabel(entry.label),
          value: entry.value || entry.label,
          source: "diagnostic",
        });
      }
    }

    // 4) Lab values the persona verbalized: during the laboratory phase the
    // nurse reads results aloud — each spoken entry lands in the panel live,
    // same as physical findings.
    if (diagAllowed && diagText && haystack) {      const diagEntries = extractDiagPairs(diagText);
      for (const entry of diagEntries) {
        if (isGarbageEntry(entry.label, entry.value)) continue;
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !labelSpokenIn(labelNorm, haystack)) continue;
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

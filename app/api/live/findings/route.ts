import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";
import { parseRequestedKeys, PHYS_SYNONYMS } from "@/features/chat/services/physFinder";

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
    .replace(/\s+/g, " ")
    .trim();
}

function findSynonymKey(text: string, groups: Record<string, string[]>): string | null {
  const lower = normalizeForMatch(text);
  for (const [key, synonyms] of Object.entries(groups)) {
    const hit = synonyms.some((s) => {
      const ns = normalizeForMatch(s);
      if (!ns) return false;
      // Short aliases ("ca", "t") are dangerously ambiguous as substrings —
      // require a whole-word match for them; longer aliases may prefix-match.
      if (ns.length <= 3) {
        return new RegExp(`(?:^| )${ns}(?:$| )`).test(lower);
      }
      return new RegExp(`(?:^| )${ns}`).test(lower);
    });
    if (hit) return key;
  }
  return null;
}

// Stage gating: findings stay hidden until their proper stage is reached.
const STAGE_ORDER = ["history", "physical", "diagnostic", "laboratory", "treatment", "communication"];
function stageAllowsReveal(source: "physical" | "diagnostic", stageType: string): boolean {
  const idx = STAGE_ORDER.indexOf(stageType);
  if (idx === -1) return true; // unknown/custom stage types: don't block
  if (source === "physical") return idx >= STAGE_ORDER.indexOf("physical");
  return idx >= STAGE_ORDER.indexOf("laboratory");
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

// Findings are stored as "Label: value" entries separated by newlines and/or
// " - " bullets — often ALL inside a single line. Split into granular
// entries so revealing one match never exposes the whole dataset.
function extractFindingsEntries(findingsText: string): FindingsEntry[] {
  const entries: FindingsEntry[] = [];
  const parts = String(findingsText || "")
    .replace(/\r?\n/g, " - ")
    .split(/\s-\s+/);
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
    userWords.some((uw) => commonPrefixLength(lw, uw) >= 5)
  );
}

// Diagnostic records are frequently JSON-as-text ("glucose": "3.8 ...").
// Extract labelled pairs from that shape first; fall back to the generic
// entry extraction for plain prose records.
function extractDiagPairs(diagText: string): FindingsEntry[] {
  const text = sanitizeDiagnosticText(diagText);
  const pairs: FindingsEntry[] = [];
  const jsonRe = /["']([a-z0-9_\- ]{2,48})["']\s*:\s*["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonRe.exec(text))) {
    const label = m[1].replace(/_/g, " ").trim();
    const value = m[2].trim();
    if (label) pairs.push({ label, value });
  }
  if (pairs.length > 0) return pairs;
  return extractFindingsEntries(text);
}

function capitalizeLabel(label: string): string {
  const clean = label.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
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

    if (physAllowed && (requestedCanonical.size > 0 || userText.trim())) {
      for (const entry of physEntries) {
        const entryKeys = canonicalKeysForLabel(entry.label);
        const canonicalHit = entryKeys.some((k) => requestedCanonical.has(k));
        const vocabHit = entryMatchesUserText(entry.label, userText);
        if (!canonicalHit && !vocabHit) continue;
        const dedupeKey = `phys:${normalizeForMatch(entry.label)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: entry.label,
          value: entry.value || entry.label,
          source: "physical",
        });
      }
    }

    // 2) What the persona verbalized: reveal entries whose label appears in
    // the persona's spoken reply, so the panel mirrors the conversation.
    const haystack = normalizeForMatch(assistantText);
    if (physAllowed && haystack) {
      for (const entry of physEntries) {
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !haystack.includes(labelNorm)) continue;
        const dedupeKey = `phys:${labelNorm}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({
          key: dedupeKey,
          label: entry.label,
          value: entry.value || entry.label,
          source: "physical",
        });
      }
    }

    // 3) Diagnostic/lab values: reveal the group only when the user mentions
    // it AND the session reached the laboratory phase. Interpretive content
    // is stripped so conclusions stay the student's job.
    const diagAllowed = stageAllowsReveal("diagnostic", stageType);
    const diagKey = diagAllowed ? findSynonymKey(userText, DIAG_SYNONYMS) : null;
    if (diagKey && diagText) {
      const synonyms = DIAG_SYNONYMS[diagKey] ?? [];
      const diagLines = extractDiagPairs(diagText)
        .filter((e) => synonyms.some((s) => `${e.label} ${e.value}`.toLowerCase().includes(s)))
        .map((e) => (e.value ? `${e.label}: ${e.value}` : e.label));
      if (diagLines.length > 0) {
        items.push({
          key: diagKey,
          label: diagKey.toUpperCase(),
          value: diagLines.join(" · "),
          source: "diagnostic",
        });
      }
    }

    // 4) Lab values the persona verbalized: during the laboratory phase the
    // nurse reads results aloud — each spoken entry lands in the panel live,
    // same as physical findings.
    if (diagAllowed && diagText && haystack) {
      const diagEntries = extractDiagPairs(diagText);
      for (const entry of diagEntries) {
        const labelNorm = normalizeForMatch(entry.label);
        if (labelNorm.length < 3 || !haystack.includes(labelNorm)) continue;
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

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Live findings lookup failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

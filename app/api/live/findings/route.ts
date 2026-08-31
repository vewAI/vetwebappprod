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
  const lower = String(text || "").toLowerCase();
  for (const [key, synonyms] of Object.entries(groups)) {
    if (synonyms.some((s) => lower.includes(s))) return key;
  }
  return null;
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
    if (!caseId || !userText.trim()) {
      return NextResponse.json({ error: "caseId and userText are required" }, { status: 400 });
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

    // 1) Explicit requests: reveal only the entries whose canonical key the
    // user asked for (on-demand strategy, entry-level granularity).
    const requested = parseRequestedKeys(userText);
    const allowedPhysKeys = new Set(Object.keys(PHYS_SYNONYMS));
    const requestedCanonical = new Set((requested.canonical ?? []).filter((k) => allowedPhysKeys.has(k)));

    const physEntries = extractFindingsEntries(physText);

    if (requestedCanonical.size > 0) {
      for (const entry of physEntries) {
        const entryKeys = canonicalKeysForLabel(entry.label);
        if (!entryKeys.some((k) => requestedCanonical.has(k))) continue;
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
    if (haystack) {
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

    // 3) Diagnostic/lab values: reveal the group only when the user mentions it.
    const diagKey = findSynonymKey(userText, DIAG_SYNONYMS);
    if (diagKey && diagText) {
      const synonyms = DIAG_SYNONYMS[diagKey] ?? [];
      const diagLines = extractFindingsEntries(diagText)
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

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Live findings lookup failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

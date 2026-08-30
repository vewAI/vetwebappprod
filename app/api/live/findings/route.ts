import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";
import { parseRequestedKeys, matchPhysicalFindings, PHYS_SYNONYMS } from "@/features/chat/services/physFinder";

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

const PHYS_LABELS: Record<string, string> = {
  heart_rate: "Heart rate",
  respiratory_rate: "Respiratory rate",
  temperature: "Temperature",
  blood_pressure: "Blood pressure",
};

type FindingItem = {
  key: string;
  label: string;
  value: string;
  source: "physical" | "diagnostic";
};

function findSynonymKey(text: string, groups: Record<string, string[]>): string | null {
  const lower = String(text || "").toLowerCase();
  for (const [key, synonyms] of Object.entries(groups)) {
    if (synonyms.some((s) => lower.includes(s))) return key;
  }
  return null;
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

    // Physical exam values: reveal only the canonical keys the user asked for
    // (on-demand strategy — same semantics as the classic chat route).
    const requested = parseRequestedKeys(userText);
    const allowedPhysKeys = new Set(Object.keys(PHYS_SYNONYMS));
    const requestedPhys = (requested.canonical ?? []).filter((k) => allowedPhysKeys.has(k));
    if (requestedPhys.length > 0 && physText) {
      const matches = matchPhysicalFindings({ ...requested, canonical: requestedPhys }, physText);
      for (const match of matches) {
        if (!match.lines?.length) continue;
        items.push({
          key: match.canonicalKey,
          label: PHYS_LABELS[match.canonicalKey] ?? match.canonicalKey.replace(/_/g, " "),
          value: match.lines.join(" · "),
          source: "physical",
        });
      }
    }

    // Diagnostic/lab values: reveal the group only when the user mentions it.
    const diagKey = findSynonymKey(userText, DIAG_SYNONYMS);
    if (diagKey && diagText) {
      const synonyms = DIAG_SYNONYMS[diagKey] ?? [];
      const lines = diagText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((line) => synonyms.some((s) => line.toLowerCase().includes(s)));
      if (lines.length > 0) {
        items.push({
          key: diagKey,
          label: diagKey.toUpperCase(),
          value: lines.join(" · "),
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

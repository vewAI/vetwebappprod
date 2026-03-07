import OpenAi from "openai";
import { NextRequest, NextResponse } from "next/server";
import { PHYS_SYNONYMS } from "@/features/chat/services/physFinder";

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

function normalizeForMatching(s: string): string {
  return String(s || "").toLowerCase().replace(/[ _\-]+/g, " ").replace(/[^a-z0-9 ]+/g, "").trim();
}

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

// PHYS_SYNONYMS moved to services/physFinder.ts to keep a single source of truth for
// physical exam synonym mappings used by both the server route and client helpers.

function findSynonymKey(text: string, groups: Record<string, string[]>): string | null {
  const tNorm = normalizeForMatching(text);
  for (const [key, syns] of Object.entries(groups)) {
    for (const s of syns) {
      if (!s) continue;
      const sNorm = normalizeForMatching(s);
      if (sNorm && tNorm.includes(sNorm)) return key;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fragmentRaw = String(body.fragment ?? "").trim();
    const stageIndex = body.stageIndex;

    if (!fragmentRaw) return NextResponse.json({ complete: true });

    const trimmed = fragmentRaw;
    const lower = trimmed.toLowerCase();
    const endsWithPunct = /[\.\?!]$/.test(trimmed);
    const words = trimmed.split(/\s+/).filter(Boolean);

    // Quick heuristics
    const stopEnding = /\b(and|or|but|so|also|then|also\b|please|uh|um|well)\s*$/i;
    if (stopEnding.test(lower) || words.length <= 2 && !endsWithPunct) {
      return NextResponse.json({ complete: false });
    }
    if (endsWithPunct && words.length >= 2) {
      // likely complete
      // attempt to canonicalize
      const diag = findSynonymKey(trimmed, DIAG_SYNONYMS);
      const phys = findSynonymKey(trimmed, PHYS_SYNONYMS);
      return NextResponse.json({ complete: true, canonical: diag ?? phys ?? null, type: diag ? 'diagnostic' : phys ? 'physical' : null });
    }

    // Ask LLM to classify completeness when heuristic is unsure
    try {
      const checkPrompt = `You are a short classifier. Answer only valid JSON.\nReceived user fragment:\n"""${trimmed}\n"""\nReturn JSON with keys: complete (true/false), reason (short), canonical (optional canonical test name key if applicable). Do not include any extra text.`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You classify whether a user utterance is a complete request or a fragment that needs continuation." },
          { role: "user", content: checkPrompt },
        ],
        temperature: 0,
        max_tokens: 150,
      });
      const text = response.choices?.[0]?.message?.content ?? "";
      // Attempt to parse JSON from model output
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const canonical = parsed.canonical ?? null;
        const complete = Boolean(parsed.complete);
        if (complete) {
          const diag = findSynonymKey(trimmed, DIAG_SYNONYMS);
          const phys = findSynonymKey(trimmed, PHYS_SYNONYMS);
          return NextResponse.json({ complete: true, canonical: canonical ?? diag ?? phys ?? null, type: diag ? 'diagnostic' : phys ? 'physical' : null });
        }
        return NextResponse.json({ complete: false });
      }
    } catch (e) {
      // fall through to default
    }

    // Default conservative behavior: treat as complete to avoid blocking
    return NextResponse.json({ complete: true });
  } catch (err) {
    console.error("check-complete error:", err);
    return NextResponse.json({ complete: true });
  }
}

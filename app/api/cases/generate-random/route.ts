import { NextRequest, NextResponse } from "next/server";
import OpenAi from "openai";
import { searchMerckManual } from "@/features/external-resources/services/merckService";
import { requireUser } from "@/app/api/_lib/auth";
import { debugEventBus } from "@/lib/debug-events-fixed";

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

const TOPICS = [
  "Canine Parvovirus",
  "Feline Hyperthyroidism",
  "Equine Colic",
  "Bovine Mastitis",
  "Canine Diabetes Mellitus",
  "Feline Chronic Kidney Disease",
  "Canine Osteosarcoma",
  "Feline Asthma",
  "Canine Leptospirosis",
  "Equine Laminitis"
];

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    // Parse optional references from body
    let references: Array<{ url?: string; caption?: string }> | undefined;
    try {
      const body = await request.json().catch(() => null);
      if (body && Array.isArray(body.references)) {
        references = body.references.map((r: any) => ({ url: String(r.url ?? ""), caption: r.caption ?? null }));
      }
    } catch (e) {
      references = undefined;
    }

    // 1. Pick a random topic
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

    // 2. Mock Merck Search (Bypass) - rely on high quality LLM knowledge
    debugEventBus.emitEvent(
      "info",
      "api/cases/generate-random",
      "Generating case from internal knowledge",
      { topic }
    );

    // 3. Generate Case using OpenAI
    // If references were provided, attempt to fetch their text (best-effort)
    let referencesText = "";
    if (Array.isArray(references) && references.length > 0) {
      const pieces: string[] = [];
      for (const ref of references) {
        if (!ref.url) continue;
        try {
          const r = await fetch(ref.url, { method: "GET" });
          const ct = r.headers.get("content-type") ?? "";
          if (ct.includes("text") || ct.includes("html")) {
            const txt = await r.text();
            pieces.push(`Reference (${ref.caption ?? ref.url}):\n${txt.substring(0, 3000)}`);
          } else {
            pieces.push(`Reference (${ref.caption ?? ref.url}): ${ref.url}`);
          }
        } catch (e) {
          pieces.push(`Reference (${ref.caption ?? ref.url}): ${ref.url}`);
        }
      }
      if (pieces.length > 0) {
        referencesText = `\n\nUser-provided references (included verbatim or by URL):\n${pieces.join("\n\n")}`;
      }
    }

    const systemPrompt = `You are an expert veterinary educator. 
    Create a realistic clinical case regarding "${topic}".
    The output must be a JSON object matching the CaseTemplate structure.
    
    Information:
    Use your extensive internal veterinary knowledge to construct this case.
    ${referencesText}
    
    Structure required (JSON):
    {
      "title": "string",
      "description": "string",
      "species": "string",
      "patient_name": "string",
      "patient_age": "string",
      "patient_sex": "string",
      "condition": "string",
      "category": "string",
      "difficulty": "Easy" | "Medium" | "Hard",
      "tags": "string",
      "details": "string",
      "physical_exam_findings": "string",
      "diagnostic_findings": "string",
      "owner_background": "string",
      "history_feedback": "string",
      "owner_follow_up": "string",
      "owner_follow_up_feedback": "string",
      "owner_diagnosis": "string",
      "get_owner_prompt": "string",
      "get_history_feedback_prompt": "string",
      "get_physical_exam_prompt": "string",
      "get_diagnostic_prompt": "string",
      "get_owner_follow_up_prompt": "string",
      "get_owner_follow_up_feedback_prompt": "string",
      "get_owner_diagnosis_prompt": "string",
      "get_overall_feedback_prompt": "string"
    }
    
    Ensure all temperatures are in Fahrenheit.
    Ensure the case is educational and clinically accurate.
    `;

    let caseData: any = null;

    // 3. Generate Case using OpenAI (must succeed)
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing in server environment");
      debugEventBus.emitEvent("error", "api/cases/generate-random", "OPENAI_API_KEY missing");
      return NextResponse.json({ error: "OpenAI API key not configured on server" }, { status: 500 });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        console.error("OpenAI returned empty content for Merck-sourced generation", completion);
        debugEventBus.emitEvent("error", "api/cases/generate-random", "OpenAI returned empty content", { completion });
        return NextResponse.json({ error: "OpenAI returned no content" }, { status: 502 });
      }

      try {
        caseData = JSON.parse(content);
      } catch (parseErr) {
        console.error("Failed to parse OpenAI content as JSON", parseErr, content);
        debugEventBus.emitEvent("error", "api/cases/generate-random", "Failed to parse OpenAI JSON", { error: String(parseErr), content });
        return NextResponse.json({ error: "Failed to parse model output" }, { status: 502 });
      }

      debugEventBus.emitEvent("success", "api/cases/generate-random", "Case generated from Merck content", { title: caseData?.title ?? null });
      return NextResponse.json(caseData);
    } catch (openaiErr) {
      console.error("OpenAI generation failed for Merck-sourced case", openaiErr);
      debugEventBus.emitEvent("error", "api/cases/generate-random", "OpenAI generation failed", { error: String(openaiErr), stack: (openaiErr as any)?.stack ?? null });
      return NextResponse.json({ error: "Failed to generate case from Merck Manual" }, { status: 502 });
    }

  } catch (error) {
    console.error("Error generating random case:", error);
    return NextResponse.json({ error: "Failed to generate case" }, { status: 500 });
  }
}

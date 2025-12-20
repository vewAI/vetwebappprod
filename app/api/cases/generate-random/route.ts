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
    // 1. Pick a random topic
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    
    // 2. Search Merck Manual
    const searchResult = await searchMerckManual(topic);
    try {
      debugEventBus.emitEvent(
        "info",
        "api/cases/generate-random",
        "Merck search completed",
        { topic, length: String((searchResult || "").length) }
      );
    } catch (e) {
      // ignore
    }

    // 3. Generate Case using OpenAI (must succeed). We require the
    // case to be explicitly generated from Merck Manual content. If
    // generation fails we return an error — no invented local fallback
    // is permitted.
    const systemPrompt = `You are an expert veterinary educator. 
    Create a realistic clinical case based on the following information from the Merck Veterinary Manual.
    The output must be a JSON object matching the CaseTemplate structure.
    
    Information:
    ${searchResult}
    
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
    Ensure the case is educational and consistent with the search results.
    `;

    let caseData: any = null;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" }
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        caseData = JSON.parse(content);
        try {
          debugEventBus.emitEvent(
            "success",
            "api/cases/generate-random",
            "Case generated from Merck content",
            { title: caseData?.title ?? null }
          );
        } catch (e) {}
        return NextResponse.json(caseData);
      }

      // If the model returned no usable content, fail rather than invent.
      console.error("OpenAI returned empty content for Merck-sourced generation");
      try {
        debugEventBus.emitEvent(
          "error",
          "api/cases/generate-random",
          "OpenAI returned empty content for Merck-sourced generation"
        );
      } catch (e) {}
      return NextResponse.json({ error: "Failed to generate case from Merck Manual" }, { status: 502 });
    } catch (openaiErr) {
      console.error("OpenAI generation failed for Merck-sourced case", openaiErr);
      try {
        debugEventBus.emitEvent(
          "error",
          "api/cases/generate-random",
          "OpenAI generation failed for Merck-sourced case",
          { error: String(openaiErr) }
        );
      } catch (e) {}
      return NextResponse.json({ error: "Failed to generate case from Merck Manual" }, { status: 502 });
    }

  } catch (error) {
    console.error("Error generating random case:", error);
    return NextResponse.json({ error: "Failed to generate case" }, { status: 500 });
  }
}

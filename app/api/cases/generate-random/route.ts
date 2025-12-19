import { NextRequest, NextResponse } from "next/server";
import OpenAi from "openai";
import { searchMerckManual } from "@/features/external-resources/services/merckService";
import { requireUser } from "@/app/api/_lib/auth";

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

    // 3. Generate Case using OpenAI (if available)
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
        return NextResponse.json(caseData);
      }
      // fallthrough to fallback below
    } catch (openaiErr) {
      console.warn("OpenAI generation failed, falling back to Merck-based template", openaiErr);
      // proceed to build a conservative fallback case from searchResult
    }

    // If OpenAI isn't available or failed, return a structured fallback
    const fallback = {
      title: `${topic} (based on Merck Veterinary Manual)`,
      description: String(searchResult).slice(0, 1000),
      species: topic.includes("Equine") || topic.includes("Horse") ? "Equine" : topic.includes("Feline") || topic.includes("Cat") ? "Feline" : topic.includes("Bovine") || topic.includes("Cow") ? "Bovine" : "Canine",
      patient_name: "Patient",
      patient_age: "Adult",
      patient_sex: "Unknown",
      condition: topic,
      category: "General Medicine",
      difficulty: "Medium",
      tags: topic.toLowerCase(),
      details: `Source excerpt:\n${searchResult}`,
      physical_exam_findings: "Physical exam findings will be provided on request.",
      diagnostic_findings: "Diagnostic findings not generated; request specific tests.",
      owner_background: "Owner is concerned and cooperative.",
      history_feedback: "",
      owner_follow_up: "",
      owner_follow_up_feedback: "",
      owner_diagnosis: topic,
      get_owner_prompt: "You are the owner. Provide concise answers to the student's questions.",
      get_history_feedback_prompt: "",
      get_physical_exam_prompt: "",
      get_diagnostic_prompt: "",
      get_owner_follow_up_prompt: "",
      get_owner_follow_up_feedback_prompt: "",
      get_owner_diagnosis_prompt: "",
      get_overall_feedback_prompt: "",
    };

    return NextResponse.json(fallback);

  } catch (error) {
    console.error("Error generating random case:", error);
    return NextResponse.json({ error: "Failed to generate case" }, { status: 500 });
  }
}

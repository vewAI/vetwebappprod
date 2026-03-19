import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin" && auth.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { emptyFields, caseData } = body;

    console.log("[AUTO-FILL-API] Received request with emptyFields:", emptyFields);

    if (!emptyFields || !Array.isArray(emptyFields) || emptyFields.length === 0) {
      return NextResponse.json({ error: "emptyFields array is required and must not be empty" }, { status: 400 });
    }

    if (!caseData || typeof caseData !== "object") {
      return NextResponse.json({ error: "caseData object is required" }, { status: 400 });
    }

    const species = caseData.species || "Unknown species";
    const condition = caseData.condition || "Unknown condition";
    const title = caseData.title || "Untitled case";
    const patientName = caseData.patient_name || "Patient";
    const details = caseData.details || "(no details provided yet)";
    const physicalExam = caseData.physical_exam_findings || "(no exam findings)";
    const diagnostics = caseData.diagnostic_findings || "(no diagnostic results)";

    const fieldDescriptions: Record<string, string> = {
      learner_facing_summary: "A compelling one-paragraph overview for learners describing the case and its clinical significance",
      owner_background: "The owner/caretaker's personality, concerns, communication style, and relationship with the animal",
      history_feedback_instructions: "LLM instructions for evaluating the student's history-taking and gathering of clinical information",
      owner_follow_up: "Dialogue template for the owner persona during diagnostic planning and treatment discussion",
      owner_follow_up_feedback_prompt: "Instructions for providing structured feedback on the student's diagnostic planning conversation",
      owner_diagnosis: "Dialogue template for the owner persona when receiving diagnostic results and discussing management",
      owner_chat_prompt: "System prompt for the owner persona during initial history-taking conversation with the student",
      follow_up_feedback_prompt: "Rubric and instructions for evaluating the student's overall case handling and clinical reasoning",
    };

    const fieldsDescription = emptyFields.map((field) => `- ${field}: ${fieldDescriptions[field] || field}`).join("\n");

    const systemPrompt = `You are an expert veterinary clinical educator and case designer. Your task is to generate realistic, educationally valuable text for teaching case fields based on the case context provided.

IMPORTANT RULES:
1. Generate content that is REALISTIC and CLINICALLY COHERENT with the case.
2. For owner/caregiver prompts: Make them conversational, slightly emotional (worried but cooperative), and true to the case.
3. For feedback instructions: Make them specific to this case's clinical learning objectives.
4. For learner-facing summary: Make it compelling, clear, and appropriate for veterinary learners.
5. Keep responses concise but substantive (2-5 sentences for most fields).
6. Return ONLY valid JSON with no markdown, no code blocks, no explanations.

Case Context:
- Species: ${species}
- Condition: ${condition}
- Title: ${title}
- Patient: ${patientName}
- Clinical Details: ${details}
- Physical Exam: ${physicalExam}
- Diagnostics: ${diagnostics}

You are asked to generate text for these empty fields:
${fieldsDescription}

Return a JSON object with ONLY these fields (one per empty field passed to you):
{
  "learner_facing_summary": "string or null",
  "owner_background": "string or null",
  "history_feedback_instructions": "string or null",
  "owner_follow_up": "string or null",
  "owner_follow_up_feedback_prompt": "string or null",
  "owner_diagnosis": "string or null",
  "owner_chat_prompt": "string or null",
  "follow_up_feedback_prompt": "string or null"
}

Only include fields that are in the emptyFields list passed. Set other fields to null.
`;

    let response;
    let lastError: Error | null = null;

    // Try gpt-4o-mini first, fallback to gpt-3.5-turbo
    for (const model of ["gpt-4o-mini", "gpt-3.5-turbo"]) {
      try {
        response = await openai.chat.completions.create({
          model,
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: systemPrompt }],
        });
        break;
      } catch (err) {
        lastError = err as Error;
        const errorMsg = lastError.message || String(lastError);
        if (errorMsg.includes("404") || errorMsg.includes("does not have access")) {
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!response) {
      const msg = lastError?.message || "No model available";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "LLM returned no content" }, { status: 502 });
    }

    const parsed = JSON.parse(content);

    // Build result with only the fields that were requested
    const suggestions: Record<string, string | null> = {};
    for (const field of emptyFields) {
      const value = parsed[field];
      if (value) {
        suggestions[field] = String(value);
        console.log(`[AUTO-FILL-API] ✓ ${field}: "${String(value).substring(0, 50)}..."`);
      } else {
        suggestions[field] = null;
        console.log(`[AUTO-FILL-API] ✗ ${field}: null or empty`);
      }
    }

    console.log("[AUTO-FILL-API] Returning suggestions:", Object.keys(suggestions));
    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

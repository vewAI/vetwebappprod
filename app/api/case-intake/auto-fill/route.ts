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
      description: "A compelling one-paragraph overview for learners describing the case and its clinical significance",
      owner_background: "The owner/caretaker's personality, concerns, communication style, and relationship with the animal",
      get_history_feedback_prompt: "LLM instructions for evaluating the student's history-taking and gathering of clinical information",
      owner_follow_up: "Dialogue template for the owner persona during diagnostic planning and treatment discussion",
      get_owner_follow_up_feedback_prompt: "Instructions for providing structured feedback on the student's diagnostic planning conversation",
      owner_diagnosis: "Dialogue template for the owner persona when receiving diagnostic results and discussing management",
      get_owner_prompt: "System prompt for the owner persona during initial history-taking conversation with the student",
      owner_follow_up_feedback: "Rubric and instructions for evaluating the student's overall case handling and clinical reasoning",
      details: "Detailed presenting complaint, history, and other relevant information about the case",
      physical_exam_findings: "Reference script with vital signs and system-by-system findings for the virtual assistant",
      diagnostic_findings: "Lab results, imaging findings, and other test results formatted for the lab persona to reveal on request",
      get_physical_exam_prompt: "System prompt for the virtual assistant when providing physical exam data to the student",
      get_diagnostic_prompt: "System prompt for the lab technician persona when releasing diagnostic results",
      get_owner_follow_up_prompt: "System prompt for the owner persona during the follow-up discussion after initial findings",
      get_owner_diagnosis_prompt: "System prompt for the owner persona when discussing diagnosis and treatment plan",
      get_overall_feedback_prompt: "Final feedback rubric for summarizing the student's overall performance in the case",
    };

    const fieldsDescription = emptyFields.map((field) => `- ${field}: ${fieldDescriptions[field] || field}`).join("\n");

    const systemPrompt = `You are an expert veterinary clinical educator and case designer. Your task is to generate realistic, educationally valuable text for teaching case fields based on the case context provided.

IMPORTANT RULES:
1. Generate content that is REALISTIC and CLINICALLY COHERENT with the case.
2. For owner/caregiver prompts: Make them conversational, slightly emotional (worried but cooperative), and true to the case.
3. For feedback instructions: Make them specific to this case's clinical learning objectives.
4. For learner-facing summary (description): Present the case from the learner's perspective. Include patient demographics, presenting complaint, observable signs (WITHOUT diagnosis), relevant history, and clinical context. DO NOT reveal diagnosis, pathology, treatment, or specific lab values.
5. For physical_exam_findings and diagnostic_findings: Be PARTICULARLY THOROUGH and COMPLETE.
6. Keep responses concise but substantive.
7. Return ONLY valid JSON with no markdown, no code blocks, no explanations.

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
  "description": "string or null",
  "owner_background": "string or null",
  "get_history_feedback_prompt": "string or null",
  "owner_follow_up": "string or null",
  "get_owner_follow_up_feedback_prompt": "string or null",
  "owner_diagnosis": "string or null",
  "get_owner_prompt": "string or null",
  "owner_follow_up_feedback": "string or null",
  "details": "string or null",
  "physical_exam_findings": "string or null",
  "diagnostic_findings": "string or null",
  "get_physical_exam_prompt": "string or null",
  "get_diagnostic_prompt": "string or null",
  "get_owner_follow_up_prompt": "string or null",
  "get_owner_diagnosis_prompt": "string or null",
  "get_overall_feedback_prompt": "string or null"
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

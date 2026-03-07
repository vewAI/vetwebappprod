import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type CompletionItem = {
  fieldKey: string;
  label: string;
  extractedValue: string;
  isMissing: boolean;
  missingReason: string;
  aiSuggestion: string;
  confidence?: number;
};

const TARGET_FIELDS: Array<{ key: string; label: string }> = [
  { key: "id", label: "Case ID" },
  { key: "title", label: "Case title" },
  { key: "description", label: "Learner-facing summary" },
  { key: "species", label: "Species" },
  { key: "patient_name", label: "Patient Name" },
  { key: "patient_age", label: "Patient Age" },
  { key: "patient_sex", label: "Patient Sex" },
  { key: "condition", label: "Primary condition" },
  { key: "category", label: "Discipline / category" },
  { key: "difficulty", label: "Difficulty" },
  { key: "details", label: "Details" },
  { key: "physical_exam_findings", label: "Physical exam findings" },
  { key: "diagnostic_findings", label: "Diagnostic findings" },
  { key: "owner_background", label: "Owner background" },
  { key: "history_feedback", label: "History feedback prompt" },
  { key: "owner_follow_up", label: "Owner follow-up script" },
  { key: "owner_follow_up_feedback", label: "Follow-up feedback prompt" },
  { key: "owner_diagnosis", label: "Diagnosis conversation" },
  { key: "get_owner_prompt", label: "Owner chat prompt" },
  { key: "get_history_feedback_prompt", label: "History feedback instructions" },
  { key: "get_physical_exam_prompt", label: "Physical exam prompt" },
  { key: "get_diagnostic_prompt", label: "Diagnostics prompt" },
  { key: "get_owner_follow_up_prompt", label: "Owner follow-up prompt" },
  { key: "get_owner_follow_up_feedback_prompt", label: "Follow-up feedback instructions" },
  { key: "get_owner_diagnosis_prompt", label: "Owner diagnosis prompt" },
  { key: "get_overall_feedback_prompt", label: "Overall feedback prompt" },
  { key: "findings_release_strategy", label: "Findings Release Strategy" },
];

function roleForbidden(role: string | null): boolean {
  return role !== "admin" && role !== "professor";
}

async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const mime = String(file.type || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (mime.includes("pdf") || fileName.endsWith(".pdf")) {
    const parsed = await pdf(buffer);
    return String(parsed.text || "").trim();
  }

  if (
    mime.includes("wordprocessingml") ||
    fileName.endsWith(".docx") ||
    mime.includes("msword") ||
    fileName.endsWith(".doc")
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return String(parsed.value || "").trim();
  }

  if (mime.startsWith("text/") || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8").trim();
  }

  throw new Error("Unsupported file type. Allowed: .pdf, .txt, .docx");
}

function buildFallback(rawInput: string): { draftCase: Record<string, string>; completionPlan: CompletionItem[]; missingCount: number; sourceSummary: string } {
  const draftCase: Record<string, string> = {
    title: "",
    description: rawInput.slice(0, 500),
    details: rawInput,
  };

  const completionPlan = TARGET_FIELDS.map((field) => {
    const value = String(draftCase[field.key] ?? "").trim();
    const isMissing = value.length === 0;
    return {
      fieldKey: field.key,
      label: field.label,
      extractedValue: value,
      isMissing,
      missingReason: isMissing
        ? "No se encontró información suficiente para este campo en el texto proporcionado."
        : "Campo detectado desde el texto fuente.",
      aiSuggestion: isMissing
        ? `Sugerencia: redacta ${field.label.toLowerCase()} de forma específica para el caso clínico.`
        : "",
      confidence: isMissing ? 0.2 : 0.6,
    } satisfies CompletionItem;
  });

  return {
    draftCase,
    completionPlan,
    missingCount: completionPlan.filter((item) => item.isMissing).length,
    sourceSummary: "Extracción base aplicada (fallback) porque el análisis con LLM no estuvo disponible.",
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (roleForbidden(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const rawTextInput = String(formData.get("rawText") ?? "").trim();
    const file = formData.get("sourceFile");

    let sourceFileText = "";
    let sourceFileName = "";
    if (file && file instanceof File && file.size > 0) {
      sourceFileText = await extractTextFromFile(file);
      sourceFileName = file.name;
    }

    const combinedInput = [rawTextInput, sourceFileText].filter(Boolean).join("\n\n---\n\n").trim();
    if (!combinedInput) {
      return NextResponse.json({ error: "Provide text or upload a file first." }, { status: 400 });
    }

    const exampleCase =
      auth.adminSupabase
        ? await auth.adminSupabase.from("cases").select("*").eq("id", "case-1").maybeSingle()
        : { data: null as Record<string, unknown> | null, error: null as unknown };

    const examplePayload =
      exampleCase && exampleCase.data && typeof exampleCase.data === "object"
        ? TARGET_FIELDS.reduce((acc, field) => {
            acc[field.key] = String((exampleCase.data as Record<string, unknown>)[field.key] ?? "");
            return acc;
          }, {} as Record<string, string>)
        : {};

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a veterinary case structuring engine. Return strict JSON only. Analyze source text and map to known fields. For each target field, return extracted value, missing flag, why missing, and a personalized suggestion in Spanish. Keep suggestions practical and case-specific.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Extract and complete veterinary case fields from source text",
              targetFields: TARGET_FIELDS,
              sourceFileName,
              sourceText: combinedInput,
              outputSchema: {
                draftCase: "Record<string,string>",
                completionPlan: [
                  {
                    fieldKey: "string",
                    label: "string",
                    extractedValue: "string",
                    isMissing: "boolean",
                    missingReason: "string",
                    aiSuggestion: "string",
                    confidence: "number_0_to_1",
                  },
                ],
                sourceSummary: "string",
              },
              canonicalExampleCase1: examplePayload,
              constraints: [
                "Do not invent impossible details; if unknown, mark missing.",
                "Keep output values plain text.",
                "If title is missing, suggest one based on condition/species.",
                "For prompts/feedback fields, propose pedagogically useful defaults personalized to this case.",
              ],
            },
            null,
            2,
          ),
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json(buildFallback(combinedInput));
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(buildFallback(combinedInput));
    }

    const draftCaseRaw = parsed?.draftCase && typeof parsed.draftCase === "object" ? parsed.draftCase : {};
    const completionPlanRaw = Array.isArray(parsed?.completionPlan) ? parsed.completionPlan : [];

    const draftCase: Record<string, string> = {};
    for (const field of TARGET_FIELDS) {
      draftCase[field.key] = String(draftCaseRaw[field.key] ?? "").trim();
    }

    const completionByField = new Map<string, any>();
    for (const item of completionPlanRaw) {
      if (!item || typeof item !== "object") continue;
      const key = String(item.fieldKey ?? "").trim();
      if (!key) continue;
      completionByField.set(key, item);
    }

    const completionPlan: CompletionItem[] = TARGET_FIELDS.map((field) => {
      const item = completionByField.get(field.key) ?? {};
      const extractedValue = String(item.extractedValue ?? draftCase[field.key] ?? "").trim();
      const isMissing =
        typeof item.isMissing === "boolean" ? item.isMissing : extractedValue.length === 0;
      const confidence = Number(item.confidence);

      return {
        fieldKey: field.key,
        label: field.label,
        extractedValue,
        isMissing,
        missingReason: String(item.missingReason ?? (isMissing ? "No se detectó contenido suficiente para este campo." : "Campo extraído desde el texto fuente.")).trim(),
        aiSuggestion: String(item.aiSuggestion ?? (isMissing ? `Sugerencia contextual: completa ${field.label.toLowerCase()} con datos clínicos concretos.` : "")).trim(),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : undefined,
      };
    });

    return NextResponse.json({
      draftCase,
      completionPlan,
      missingCount: completionPlan.filter((item) => item.isMissing).length,
      sourceSummary: String(parsed?.sourceSummary ?? "Análisis completado."),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

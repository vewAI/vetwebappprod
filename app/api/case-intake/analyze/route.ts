import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { requireUser } from "@/app/api/_lib/auth";

// NOTE: openai client will be created per-request after validating the
// configured provider and API key. This prevents accidentally sending
// a non-OpenAI key (for example a Google API key) to OpenAI and producing
// confusing errors in logs.

type CompletionItem = {
  fieldKey: string;
  label: string;
  extractedValue: string;
  isMissing: boolean;
  missingReason: string;
  aiSuggestion: string;
  confidence?: number;
};

const TARGET_FIELDS: Array<{ key: string; label: string; guide: string }> = [
  // ── Core identity ──
  { key: "id", label: "Case ID", guide: "Short lowercase slug, e.g. 'case-equine-colic'. Auto-generated if blank." },
  {
    key: "title",
    label: "Case title",
    guide:
      "A descriptive, learner-friendly title, e.g. 'Catalina the Cob Mare: Fever and Nasal Discharge'. Include patient name and chief complaint.",
  },
  {
    key: "description",
    label: "Learner-facing summary",
    guide:
      "One-paragraph overview (3-5 sentences) that sets the scene for the learner. Appears on case selection cards. Include species, signalment, presenting complaint, and learning focus.",
  },
  { key: "species", label: "Species", guide: "Must be exactly one of: Equine, Bovine, Canine, Feline, Ovine, Caprine, Porcine, Camelid, Avian." },
  { key: "patient_name", label: "Patient Name", guide: "Name of the animal patient. If not in source, generate one appropriate for species." },
  { key: "patient_age", label: "Patient Age", guide: "Age of the patient, e.g. '8 years', '6 months'." },
  { key: "patient_sex", label: "Patient Sex", guide: "Must be one of: Male, Female, Gelding, Mare, Stallion, Steer, Heifer, Bull, Cow." },
  { key: "condition", label: "Primary condition", guide: "Top-level medical focus, e.g. 'Suspected Streptococcus equi infection'." },
  {
    key: "category",
    label: "Discipline / category",
    guide:
      "Must be one of: Internal Medicine, Surgery, Infectious Disease, Theriogenology, Anesthesiology, Dermatology, Ophthalmology, Neurology, Cardiology, Oncology, Dentistry, Sports Medicine, Preventive Medicine.",
  },
  { key: "difficulty", label: "Difficulty", guide: "One of: Easy, Medium, Hard." },
  {
    key: "findings_release_strategy",
    label: "Findings Release Strategy",
    guide: "Must be 'immediate' or 'on_demand'. Use 'on_demand' for most cases (student must ask for specific findings).",
  },
  {
    key: "tags",
    label: "Tags",
    guide: "Comma-separated tags for search and filtering, e.g. 'colic, equine, emergency'. Generate 4-6 relevant clinical tags.",
  },
  { key: "estimated_time", label: "Estimated time (minutes)", guide: "Approximate duration in minutes. Simple=15, medium=25, complex=35." },

  // ── Clinical content (EXTRACT from source) ──
  {
    key: "details",
    label: "Details",
    guide:
      "Full case details including presenting complaint, history, environment, management, vaccination status. Include all clinical context from the source. This is the comprehensive case write-up.",
  },
  {
    key: "physical_exam_findings",
    label: "Physical exam findings",
    guide:
      "Vitals (temp in °C and °F, HR bpm, RR brpm, CRT, mucous membranes), body condition score, then system-by-system findings with values and units. Format: one finding per line. This is the reference the nurse persona reads from during the simulation.",
  },
  {
    key: "diagnostic_findings",
    label: "Diagnostic findings",
    guide:
      "Lab work and diagnostic results. For numeric laboratory analytes (CBC, biochemistry, electrolytes), present results in a Markdown table with columns: Test | Analyte | Value | Units | Reference Range | Note. Example row: `| CBC | PCV | 51 | % | 32-45 | high |`. For imaging or narrative findings (radiography, ultrasound), include short bullet points below the table. Do NOT invent numeric values — extract them from the source or mark as pending/unavailable.",
  },

  // ── Owner persona content (GENERATE case-specific) ──
  {
    key: "owner_background",
    label: "Owner background",
    guide:
      "GENERATE a detailed owner persona: name, personality (anxious/stoic/demanding), relationship with animal, financial situation, what they noticed, concerns they'll voice, tone progression (worried→cooperative). 4-6 sentences.",
  },
  {
    key: "owner_follow_up",
    label: "Owner follow-up script",
    guide:
      "GENERATE talking points for the owner persona after the initial exam. Include: questions about which tests and why, cost concerns, logistics (how long, when results), worry about the animal's comfort. 4-6 bullet points.",
  },
  {
    key: "owner_diagnosis",
    label: "Diagnosis conversation",
    guide:
      "GENERATE reference dialogue for the owner when receiving the diagnosis. Include: initial reaction, concerns about treatment duration/cost, questions about monitoring at home, prognosis questions, and whether other animals are at risk. 4-6 sentences.",
  },

  // ── Feedback rubrics (GENERATE pedagogically useful content) ──
  {
    key: "history_feedback",
    label: "History feedback prompt",
    guide:
      "GENERATE a structured rubric: list the 5-8 key history domains the student should explore for THIS case (e.g., onset/duration, diet, vaccination, exposure risks, prior episodes). For each domain, note what a thorough answer looks like.",
  },
  {
    key: "owner_follow_up_feedback",
    label: "Follow-up feedback prompt",
    guide:
      "GENERATE a rubric for evaluating diagnostic planning communication. Include: Did student explain test rationale? Discuss costs? Address biosecurity/isolation? Handle owner concerns? Provide timeline? 4-6 criteria.",
  },

  // ── System prompts for AI personas (GENERATE as LLM instructions) ──
  {
    key: "get_owner_prompt",
    label: "Owner chat prompt",
    guide:
      "GENERATE a system prompt (5-10 sentences) for the owner AI persona during live chat. Include: 'You are [name], the [role] of [patient]...', personality traits, presenting complaint in owner's words, what info to volunteer upfront vs withhold until asked, emotional arc, language style (plain, avoid jargon).",
  },
  {
    key: "get_history_feedback_prompt",
    label: "History feedback instructions",
    guide:
      "GENERATE LLM instructions: 'FIRST check for minimal interaction (< 3 substantive questions → give guidance mode). For sufficient interaction, evaluate against these domains: [list THIS case's key history domains]. Highlight what was done well, identify gaps, suggest 2-3 follow-up questions.'",
  },
  {
    key: "get_physical_exam_prompt",
    label: "Physical exam prompt",
    guide:
      "GENERATE a system prompt for the nurse persona: 'You are a veterinary nurse supporting the examination of [patient]. Share only the specific finding the student asks about. If the request is vague, ask them to specify. Never interpret findings or suggest diagnoses.'",
  },
  {
    key: "get_diagnostic_prompt",
    label: "Diagnostics prompt",
    guide:
      "GENERATE a system prompt for the lab technician: 'You are a laboratory technician reporting results for [patient]. Release one result at a time when asked. State if a test is pending. Do not interpret beyond raw data. Include units.'",
  },
  {
    key: "get_owner_follow_up_prompt",
    label: "Owner follow-up prompt",
    guide:
      "GENERATE a prompt for the owner during post-exam discussion: 'You are [owner name] discussing next steps. Ask about: which tests and why, costs, how long results take, animal comfort. Become more cooperative once the student explains clearly.'",
  },
  {
    key: "get_owner_follow_up_feedback_prompt",
    label: "Follow-up feedback instructions",
    guide:
      "GENERATE a rubric: 'Evaluate the student on: diagnostic prioritization, cost/logistics communication, handling of owner concerns, biosecurity advice if applicable, overall communication clarity.'",
  },
  {
    key: "get_owner_diagnosis_prompt",
    label: "Owner diagnosis prompt",
    guide:
      "GENERATE a prompt for the owner receiving results: 'You are [owner name] hearing the diagnosis. Ask about: treatment plan, duration, costs, prognosis, monitoring at home, risk to other animals. React naturally.'",
  },
  {
    key: "get_overall_feedback_prompt",
    label: "Overall feedback prompt",
    guide:
      "GENERATE: 'Evaluate the student across all stages. Case-specific objectives: [list 4-6 learning objectives for THIS case]. Check: history thoroughness, exam strategy, diagnostic reasoning, client communication, biosecurity/management advice. Use Calgary-Cambridge framework for communication assessment.'",
  },
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

  if (mime.includes("wordprocessingml") || fileName.endsWith(".docx") || mime.includes("msword") || fileName.endsWith(".doc")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return String(parsed.value || "").trim();
  }

  if (mime.startsWith("text/") || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8").trim();
  }

  throw new Error("Unsupported file type. Allowed: .pdf, .txt, .docx");
}

function buildFallback(rawInput: string): {
  draftCase: Record<string, string>;
  completionPlan: CompletionItem[];
  missingCount: number;
  sourceSummary: string;
} {
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
      aiSuggestion: isMissing ? `Sugerencia: redacta ${field.label.toLowerCase()} de forma específica para el caso clínico.` : "",
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

    // Guard: if the user provided only a very short input (e.g., "hello") or
    // the text doesn't contain any species clues, skip the LLM to avoid it
    // inventing species or other clinical details. Return a conservative
    // fallback that preserves the user's raw input.
    const lower = combinedInput.toLowerCase();
    const speciesHints = [
      "dog",
      "canine",
      "cat",
      "feline",
      "horse",
      "equine",
      "cow",
      "bovine",
      "sheep",
      "ovine",
      "goat",
      "caprine",
      "pig",
      "porcine",
      "camel",
      "camelid",
      "avian",
      "bird",
    ];

    const hasSpeciesHint = speciesHints.some((s) => lower.includes(s));
    const wordCount = combinedInput.split(/\s+/).filter(Boolean).length;
    if (!hasSpeciesHint && (combinedInput.length < 40 || wordCount < 6)) {
      // Return the safe fallback to avoid fabricating species/clinical data
      return NextResponse.json(buildFallback(combinedInput));
    }

    const exampleCase = auth.adminSupabase
      ? await auth.adminSupabase.from("cases").select("*").eq("id", "case-1").maybeSingle()
      : { data: null as Record<string, unknown> | null, error: null as unknown };

    const examplePayload =
      exampleCase && exampleCase.data && typeof exampleCase.data === "object"
        ? TARGET_FIELDS.reduce(
            (acc, field) => {
              acc[field.key] = String((exampleCase.data as Record<string, unknown>)[field.key] ?? "");
              return acc;
            },
            {} as Record<string, string>,
          )
        : {};

    // Strengthen prompt: explicitly forbid inventing species or making up
    // definitive patient attributes when they're not present in the source.
    // If a value is missing, return an empty string or mark as missing.
    // Resolve LLM provider for this feature. If a non-OpenAI provider is
    // configured, return a helpful error (caller can fall back to a
    // provider-specific implementation later).
    try {
      const llm = await import("@/lib/llm");
      const provider = await llm.resolveProviderForFeature("chat");
      if (provider !== "openai") {
        return NextResponse.json(
          { error: `LLM provider '${provider}' is configured. This endpoint currently requires an OpenAI provider.` },
          { status: 500 },
        );
      }
    } catch (__) {
      // If provider resolution fails, assume OpenAI (backwards compatibility)
    }

    // Create validated OpenAI client for this request
    let openai: any;
    try {
      openai = await createOpenAIClient();
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a veterinary case structuring engine for an AI-powered clinical simulation platform. Return strict JSON only.\n\nYour job has TWO parts:\n1. EXTRACT: Pull factual data (species, condition, findings, vitals, lab values) directly from the source text.\n2. GENERATE: For ALL prompt, feedback, rubric, and persona fields you MUST generate rich, case-specific content. These fields power the AI simulation — the owner persona, nurse persona, lab technician persona, and the evaluation rubrics. Read each field's 'guide' carefully and produce content that matches.\n\nField categories:\n- Fields with 'EXTRACT' in guide → pull from source text\n- Fields with 'GENERATE' in guide → you MUST create case-specific content even if source doesn't mention it\n- Fields starting with 'get_' → these are LLM system prompts; write them as instructions to another AI\n- Fields ending in '_feedback' → these are evaluation rubrics; write them as assessment criteria\n- Fields like 'owner_background', 'owner_follow_up', 'owner_diagnosis' → character profiles and talking points\n\nFor each target field, return the value, missing flag, reason, and a suggestion in Spanish.\n\nCRITICAL RULES:\n- DO NOT INVENT species, sexes, ages, or numeric clinical values that are not explicitly present in the source text. If a value is not present, return an empty string for that draft field and mark it as missing in the completionPlan.\n- NEVER mark a prompt/feedback/persona field as missing. ALWAYS generate quality content for them.\n- For clinical data fields, only extract what the source provides. If truly absent, mark missing.\n- Content fields should be 3-10 sentences each. System prompts should be 5-10 sentences.",
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
                "ZERO EMPTY FIELDS: Every key in draftCase must have a non-empty string value. The only exception is patient_name if truly not mentioned.",
                "GENERATE ALL PROMPTS: Fields starting with 'get_' are system prompts for AI personas. ALWAYS generate them, personalized to this case. Never leave them empty or mark them missing.",
                "GENERATE ALL RUBRICS: Fields ending in '_feedback' are evaluation rubrics. ALWAYS generate them with case-specific assessment criteria.",
                "GENERATE PERSONA CONTENT: Fields like 'owner_background', 'owner_follow_up', 'owner_diagnosis' are character profiles. ALWAYS generate them with case-specific personality and dialogue.",
                "EXTRACT CLINICAL DATA: For 'physical_exam_findings' and 'diagnostic_findings', extract from source with exact values and units. If not in source, mark missing.",
                "DATA PRESERVATION IS SACRED: NEVER remove, simplify, or paraphrase clinical specifics from the source text. If the professor included breed-specific notes, unusual observations, environmental details, management nuances, or seemingly minor clinical findings, they are INTENTIONAL and CRITICAL to the case. Copy them VERBATIM into the appropriate fields. Every detail the professor bothered to include matters.",
                "APPEND, NEVER PRUNE: When generating content for fields that already have source data, ADD to what exists rather than replacing or summarizing it. The clinical nuances that make each case unique are exactly what makes it educational.",
                "Do not invent impossible clinical details (vitals, lab values); only mark clinical data fields as missing if truly unknown.",
                "For select fields (species, category, difficulty, patient_sex, findings_release_strategy), use ONLY the exact allowed values listed in the guide.",
                "Tags: generate 4-6 relevant clinical tags from the case content.",
                "Estimated_time: simple=15, medium=25, complex=35 based on case complexity.",
                "Each generated field should contain 3-10 substantive sentences. Do not write one-liners for prompt or feedback fields.",
                "Personalize EVERYTHING: use the patient name, species, condition, and clinical scenario in every generated field. No generic templates.",
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
      const isMissing = typeof item.isMissing === "boolean" ? item.isMissing : extractedValue.length === 0;
      const confidence = Number(item.confidence);

      return {
        fieldKey: field.key,
        label: field.label,
        extractedValue,
        isMissing,
        missingReason: String(
          item.missingReason ?? (isMissing ? "No se detectó contenido suficiente para este campo." : "Campo extraído desde el texto fuente."),
        ).trim(),
        aiSuggestion: String(
          item.aiSuggestion ?? (isMissing ? `Sugerencia contextual: completa ${field.label.toLowerCase()} con datos clínicos concretos.` : ""),
        ).trim(),
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

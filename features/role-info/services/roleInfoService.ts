import { case1RoleInfo } from "../case1";
import { dbRoleInfo } from "../db-role-info";
import { caseConfig } from "@/features/config/case-config";
import type { RoleInfo, RoleInfoPromptFn } from "../types";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { CASE_SEEDS, type CaseSeed } from "@/data/cases/case-seed-data";
import type { Stage } from "@/features/stages/types";
import { resolvePersonaRoleKey } from "@/features/personas/services/personaImageService";

type CaseRow = Record<string, unknown> | null;

export type RolePromptKey =
  | "getOwnerPrompt"
  | "getPhysicalExamPrompt"
  | "getDiagnosticPrompt"
  | "getOwnerFollowUpPrompt"
  | "getOwnerDiagnosisPrompt"
  | "getTreatmentPlanPrompt";

type RolePromptContext = {
  caseRow: CaseRow;
  userMessage: string;
};

type RolePromptDefinition = {
  defaultTemplate: string;
  placeholderDocs: { token: string; description: string }[];
  buildReplacements: (context: RolePromptContext) => Record<string, string>;
};

const DEFAULT_OWNER_BACKGROUND = (title: string) =>
  `Role: Animal Owner (concerned but cooperative)\nPatient: ${title}\n\nProvide clear, concise answers and volunteer information only when specifically asked.`;

const DEFAULT_FOLLOW_UP = (title: string) =>
  `You are the owner of ${title}. You want to understand which diagnostic tests are necessary, why they matter, how much they cost, and what to expect for your animal.`;

const DEFAULT_DIAGNOSIS_PROMPT = (title: string) =>
  `You are the owner receiving a diagnosis and discharge plan for ${title}. Ask practical questions about monitoring, medication, prognosis, and when to seek help.`;

function extractCaseField(caseRow: CaseRow, key: string): string {
  if (!caseRow || typeof caseRow !== "object") {
    return "";
  }
  const value = (caseRow as Record<string, unknown>)[key];
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function loadSeedCase(caseId: string): Record<string, unknown> | null {
  const seed: CaseSeed | undefined = CASE_SEEDS.find((entry) => entry.id === caseId);
  if (!seed) {
    return null;
  }
  return { ...seed, details: seed.details ?? {} } as Record<string, unknown>;
}

function buildPhysicalExamFallback(caseRow: CaseRow): string {
  const title = getCaseTitle(caseRow);
  const presentingComplaint = getPresentingComplaint(caseRow, title);
  const condition = extractCaseField(caseRow, "condition");
  const species = extractCaseField(caseRow, "species");
  const description = extractCaseField(caseRow, "description");

  const contextLines: string[] = [];
  if (presentingComplaint) {
    contextLines.push(`Presenting complaint: ${presentingComplaint}`);
  }
  if (condition) {
    contextLines.push(`Working impression: ${condition}`);
  }
  if (species) {
    contextLines.push(`Species: ${species}`);
  }
  if (description && description !== presentingComplaint) {
    contextLines.push(`Case summary: ${description}`);
  }
  if (contextLines.length === 0) {
    contextLines.push(`Case context: ${title}`);
  }
  contextLines.push(
    [
      "Use these instructions to report the completed exam:",
      "- Provide exact vital signs (temperature, heart rate, respiratory rate, perfusion metrics) as recorded.",
      "- List every abnormal finding tied to this scenario—lymph node enlargement, discharges, pain responses, hydration status, gastrointestinal changes, or other pertinent systems.",
      "- Mention a system as normal only when the case details justify it; otherwise supply physiologically plausible abnormal measurements that match this context."
    ].join("\n")
  );

  return contextLines.join("\n");
}

export const ROLE_PROMPT_DEFINITIONS: Record<RolePromptKey, RolePromptDefinition> = {
  getOwnerPrompt: {
    defaultTemplate: `You are roleplaying as the owner or caretaker in a veterinary consultation. Your goal is to simulate a realistic client interaction. Stay in character according to the background below.

STRICT GUARDRAILS (NEVER violate these):
- NEVER reveal, state, or hint at the diagnosis. You do not know what is wrong medically.
- NEVER describe physical exam findings or clinical metrics (e.g., "her heart rate seems high," "there's a ping on her side"). You only observe external behavior.
- NEVER mention lab results, diagnostic findings, or internal metrics. You have no access to these.
- NEVER suggest specific medical treatments, medications, or surgeries. That is the vet's job.
- You observe SYMPTOMS (what the animal does/looks like) not SIGNS (clinical measurements). You are a layperson.

ROLE & TONE:
- Urgent to Collaborative: Begin with worry/urgency about your animal. If the vet provides reassurance or a clear plan, shift to partnership (e.g., "What can I do at home to help?").
- Non-Expert but Observant: Speak in natural, everyday language. Do NOT use medical jargon unless the vet introduces it first. If complex terms are used, ask for clarification.
- Invested: Show you are engaged. Discuss logistics and costs when appropriate (e.g., "What can I expect in terms of expenses?").
- Always refer to the user as 'Doctor' or 'Vet'.

INTERACTION GUIDELINES:
- Do NOT dump all information at once. Allow the veterinarian to lead the conversation.
- Provide history in response to questions, giving clear, concise details about symptoms.
- Encourage Reasoning: If the vet presents a plan, ask: "What makes you think that's the best approach?"
- Challenge Vagueness: If their response is unclear, gently ask: "Can you help me understand why that's important?"
- Flag Missed Steps: If the vet seems to overlook something, innocently ask about it WITHOUT stating the answer yourself (e.g., "Is there anything else you need to check?" not "Did you check for X which showed Y?").
- Address concerns one by one. Never list more than two points in a single response.

CASE CONTEXT:
Presenting complaint:\n{{PRESENTING_COMPLAINT}}

Owner background:\n{{OWNER_BACKGROUND}}

RESPONSE INSTRUCTIONS:
- If this is the start of the conversation, describe the presenting complaint in your own words using specific observations.
- Otherwise, reply to the veterinarian's question while strictly following the guardrails and guidelines above.
- Stay true to the owner personality, collaborate willingly, and avoid offering diagnostic reasoning of your own.

Doctor's question: {{STUDENT_QUESTION}}`,
    placeholderDocs: [
      { token: "{{PRESENTING_COMPLAINT}}", description: "Formatted presenting complaint drawn from the case record." },
      { token: "{{OWNER_BACKGROUND}}", description: "Owner background narrative sourced from the case record." },
      { token: "{{STUDENT_QUESTION}}", description: "Latest clinician question or request." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => {
      const title = getCaseTitle(caseRow);
      return {
        PRESENTING_COMPLAINT: getPresentingComplaint(caseRow, title),
        OWNER_BACKGROUND: getText(caseRow, "owner_background", DEFAULT_OWNER_BACKGROUND(title)),
        STUDENT_QUESTION: userMessage,
      };
    },
  },
  getPhysicalExamPrompt: {
    defaultTemplate: `You are a veterinary nurse/technician assisting a student. You have the clipboard with the results of the physical examination.

Completed examination record:
{{FINDINGS}}

STRICT GUARDRAILS (Non-Negotiable):
- NO DIAGNOSIS: NEVER mention the diagnosis, condition name, or any diagnostic summary. If the findings contain a summary or diagnosis, you MUST ignore that part completely.
- NO TREATMENT: NEVER provide or suggest treatment plans. That is the student's responsibility to determine.
- STRICT SCOPE: Provide ONLY the specific information requested. If the student asks for "vitals", do not provide abdominal findings, cardiac auscultation, or other systems.
- NATURAL LANGUAGE: Do NOT output raw JSON, code blocks, or data structures. Present data in professional, clinical spoken language.

INFORMATION DELIVERY RULES:
- Role Hierarchy: You PROVIDE information from the records. You do NOT ask the student for findings. You are the one holding the clipboard.
- Temperature: ALWAYS report temperatures in BOTH Fahrenheit (°F) AND Celsius (°C). Formula: °F = °C × 1.8 + 32
- Missing Data: If asked for something not in the record, state it was "not recorded" or is "unremarkable/within normal limits" based on context. Do NOT invent abnormal values.
- Conciseness: Be helpful and professional, but do NOT volunteer extra categories of data not explicitly requested.
- No Questions: Do not ask the student what they found. You are reporting, not quizzing.

Release Strategy:
{{RELEASE_STRATEGY_INSTRUCTION}}

Student request: {{STUDENT_REQUEST}}`,
    placeholderDocs: [
      { token: "{{FINDINGS}}", description: "Physical examination findings for the case." },
      { token: "{{STUDENT_REQUEST}}", description: "Latest clinician question or request." },
      { token: "{{RELEASE_STRATEGY_INSTRUCTION}}", description: "Instruction on how to reveal findings (all at once vs on demand)." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => {
      const strategy = getText(caseRow, "findings_release_strategy", "immediate");
      const instruction = strategy === "on_demand"
        ? `CRITICAL: Only reveal findings for the EXACT body system or parameter the student requested. DO NOT provide findings from other systems.

Example correct behavior:
- Student asks: "What are the vitals?" → Only provide vital signs (temperature, heart rate, respiratory rate, blood pressure). Do NOT include other physical exam findings.
- Student asks: "What did you find on abdominal palpation?" → Only provide abdominal findings. Do NOT include vitals, cardiac auscultation, or other systems.
- Student asks: "What are all the findings?" or asks generally → Ask the student to specify which system they want: "Which findings would you like? For example: vitals, cardiovascular, respiratory, abdominal, or musculoskeletal?"

If the student has not yet requested a specific system, ask them to specify before revealing any data.

When asked to 'double-check' or confirm a previous statement, DO NOT invent or change findings. Re-check only the recorded data and respond exactly with what is present in the record. If a requested item is not recorded, reply clearly: "That finding was not recorded during the exam." Do not fill gaps by guessing or revising earlier assertions.`
        : "If the student asks for findings generally, provide the complete list of available findings immediately.";
      
      return {
        FINDINGS: getText(
          caseRow,
          "physical_exam_findings",
          buildPhysicalExamFallback(caseRow)
        ),
        STUDENT_REQUEST: userMessage,
        RELEASE_STRATEGY_INSTRUCTION: instruction,
      };
    },
  },
  getDiagnosticPrompt: {
    defaultTemplate: `You are a veterinary nurse/technician or laboratory technician assisting a student. You have the clipboard with the diagnostic test results.

Diagnostic results:
{{DIAGNOSTIC_RESULTS}}

STRICT GUARDRAILS (Non-Negotiable):
- NO DIAGNOSIS: NEVER mention the diagnosis, condition name, or "diagnostics_summary". If the results contain a summary or diagnosis field, you MUST ignore it completely.
- NO TREATMENT: NEVER provide or suggest treatment plans. That is the student's responsibility.
- STRICT SCOPE: Provide ONLY the specific test or category requested. If the student asks for "Haematology", do NOT provide "Ultrasound", "Biochemistry", or "Ketones".
- NATURAL LANGUAGE: Do NOT output raw JSON, code blocks, or data structures. Present data in professional, clinical spoken language.

INFORMATION DELIVERY RULES:
- Role Hierarchy: You PROVIDE information from the records. You do NOT ask the student for findings.
- Missing Data: If asked for something not in the record, state it is "not available" or "within normal limits" based on context. Do NOT invent values.
- Conciseness: Be helpful and professional, but do NOT volunteer extra categories of data not explicitly requested.

STANDARD TEST PROFILES (use these when specific tests are requested):
- If asked for "Haematology" or "CBC": Report ONLY: RBC, HCT, haemoglobin, WBC, neutrophils, band neutrophils, lymphocytes, monocytes, basophils, eosinophils, and PLT. If a parameter is missing, report it as "within normal limits".
- If asked for "Biochemistry" or "Chemistry panel": Report ONLY: glucose, creatinine, ALP, AST, CK, GGT, Urea, bilirubin, total protein, albumin, globulin, Sodium, Chloride, Potassium, and Calcium. If a parameter is missing, report it as "within normal limits".

Release Strategy:
{{RELEASE_STRATEGY_INSTRUCTION}}

Student request: {{STUDENT_REQUEST}}`,
    placeholderDocs: [
      { token: "{{DIAGNOSTIC_RESULTS}}", description: "Laboratory and diagnostic findings for the case." },
      { token: "{{STUDENT_REQUEST}}", description: "Latest clinician question or request." },
      { token: "{{RELEASE_STRATEGY_INSTRUCTION}}", description: "Instruction on how to reveal findings (all at once vs on demand)." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => {
      const strategy = getText(caseRow, "findings_release_strategy", "immediate");
      const instruction = strategy === "on_demand"
        ? `CRITICAL: Only reveal results for the EXACT test or category the student requested. DO NOT provide results from other tests.

Example correct behavior:
- Student asks: "What are the biochemistry results?" → Only provide biochemistry/chemistry panel values. Do NOT include CBC, urinalysis, ultrasound, x-ray, or any other tests.
- Student asks: "What is the CBC?" → Only provide CBC values. Do NOT include chemistry, urinalysis, or imaging results.
- Student asks: "What are all the results?" or asks generally → Ask the student to specify which test they want: "Which specific test results would you like to see? For example: CBC, chemistry panel, urinalysis, or imaging?"

If the student has not yet requested a specific category, ask them to specify before revealing any data.

If asked to re-check or confirm previous output, DO NOT fabricate or alter results. Review only the recorded diagnostic data and state exactly what is present. If a specific value is absent, say: "That result is not available in the record." Do not invent values or contradict earlier messages.`
        : "If the student asks for results generally, provide all available diagnostic findings immediately.";

      return {
        DIAGNOSTIC_RESULTS: getText(
          caseRow,
          "diagnostic_findings",
          "No diagnostic tests have been performed yet."
        ),
        STUDENT_REQUEST: userMessage,
        RELEASE_STRATEGY_INSTRUCTION: instruction,
      };
    },
  },
  getOwnerFollowUpPrompt: {
    defaultTemplate: `You are the owner discussing next steps after the initial examination.

STRICT GUARDRAILS (NEVER violate these):
- NEVER reveal or hint at the diagnosis yourself. Wait for the vet to explain.
- NEVER describe physical exam findings or clinical metrics. You don't have access to these.
- NEVER mention specific lab results unless the vet has already told you about them.
- NEVER suggest specific treatments. That is the vet's job to recommend.
- You are a layperson, NOT a vet. Do not use medical jargon unless the vet introduced it first.

ROLE & TONE:
- Start slightly anxious about your animal's condition.
- Ask about logistics, costs, and comfort for your animal.
- Become more cooperative once the clinician explains their plan clearly.
- Always refer to the user as 'Doctor' or 'Vet'.
- If the vet uses technical terms, ask for clarification in simple language.

INTERACTION GUIDELINES:
- Encourage the vet to explain their reasoning: "What makes you think we should do that?"
- Ask practical questions: "How long will this take?" "What are the costs?" "What should I watch for at home?"
- Do NOT ask for clinical history from the doctor; you are the one who knows the animal's history.
- Address concerns one at a time. Do not overwhelm with multiple questions.

Guidance:\n{{FOLLOW_UP_GUIDANCE}}

Doctor's explanation/question: {{STUDENT_QUESTION}}`,
    placeholderDocs: [
      { token: "{{FOLLOW_UP_GUIDANCE}}", description: "Owner follow-up guidance from the case." },
      { token: "{{STUDENT_QUESTION}}", description: "Latest clinician explanation or question." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => {
      const title = getCaseTitle(caseRow);
      return {
        FOLLOW_UP_GUIDANCE: getText(caseRow, "owner_follow_up", DEFAULT_FOLLOW_UP(title)),
        STUDENT_QUESTION: userMessage,
      };
    },
  },
  getOwnerDiagnosisPrompt: {
    defaultTemplate: `You are the owner receiving the diagnosis and treatment plan for {{CASE_TITLE}}.

STRICT GUARDRAILS (NEVER violate these):
- NEVER state the diagnosis yourself. The vet tells you; you respond to what they say.
- NEVER suggest or recommend specific treatments. Listen to what the vet recommends.
- NEVER use medical jargon unless the vet has already used and explained it.
- You are a layperson receiving information, not providing medical opinions.

ROLE & TONE:
- Listen carefully to the vet's explanation.
- Ask clarifying questions about what the diagnosis means in practical terms.
- Show concern but also relief when a clear plan is presented.
- Always refer to the user as 'Doctor' or 'Vet'.

INTERACTION GUIDELINES:
- Ask about timelines: "How long until we see improvement?"
- Ask about monitoring: "What signs should I watch for at home?"
- Ask about costs: "What can I expect in terms of expenses?"
- Ask about prognosis: "What are the chances of full recovery?"
- Ask about aftercare: "What do I need to do at home?"
- Address concerns one at a time. Do not overwhelm with multiple questions.

Owner profile:\n{{OWNER_DIAGNOSIS}}

Doctor explanation: {{STUDENT_QUESTION}}`,
    placeholderDocs: [
      { token: "{{CASE_TITLE}}", description: "Case title or patient identifier." },
      { token: "{{OWNER_DIAGNOSIS}}", description: "Owner diagnosis guidance from the case." },
      { token: "{{STUDENT_QUESTION}}", description: "Latest clinician explanation or question." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => {
      const title = getCaseTitle(caseRow);
      return {
        CASE_TITLE: title,
        OWNER_DIAGNOSIS: getText(caseRow, "owner_diagnosis", DEFAULT_DIAGNOSIS_PROMPT(title)),
        STUDENT_QUESTION: userMessage,
      };
    },
  },
  getTreatmentPlanPrompt: {
    defaultTemplate: `You are a veterinary nurse/technician receiving treatment instructions from the veterinarian (student).

Patient: {{CASE_TITLE}}

STRICT GUARDRAILS (Non-Negotiable):
- NO DIAGNOSIS: Do NOT state or confirm the diagnosis. The student should have already determined this.
- NO TREATMENT SUGGESTIONS: Do NOT offer your own treatment plan or suggest medications. You RECEIVE instructions, you do not GIVE them.
- FOLLOW THE STUDENT'S LEAD: Your role is to execute, confirm, and clarify - not to prescribe.
- NATURAL LANGUAGE: Speak professionally and naturally. Do NOT output raw JSON or data structures.

INFORMATION DELIVERY RULES:
- Confirmation: When the student gives clear instructions, confirm them (e.g., "Understood, I will administer [medication] at [dose]").
- Clarification: If instructions are vague or incomplete, ask for specifics:
  - "What dosage would you like for that?"
  - "How frequently should I administer this?"
  - "What route of administration - IV, IM, or subcutaneous?"
  - "For how long should we continue this treatment?"
- Practical Questions: You may ask about logistics:
  - "Should I prepare the IV fluids now?"
  - "Do you want me to monitor any specific parameters?"
- Missing Information: If the student hasn't specified something critical, prompt them professionally.

Student instructions: {{STUDENT_REQUEST}}`,
    placeholderDocs: [
      { token: "{{CASE_TITLE}}", description: "Case title or patient identifier." },
      { token: "{{STUDENT_REQUEST}}", description: "Latest clinician instructions." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => ({
      CASE_TITLE: getCaseTitle(caseRow),
      STUDENT_REQUEST: userMessage,
    }),
  },
};

function getText(
  caseRow: CaseRow,
  key: string,
  fallback: string
): string {
  const data = caseRow && typeof caseRow === "object" ? (caseRow as Record<string, unknown>) : null;
  const value = data?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn(`Failed to stringify field ${key}`, error);
    }
  }
  return fallback;
}

function getCaseTitle(caseRow: CaseRow): string {
  const rawTitle =
    typeof caseRow?.["title"] === "string" ? (caseRow?.["title"] as string) : "the patient";
  const trimmed = rawTitle.trim();
  return trimmed.length > 0 ? trimmed : "the patient";
}

function getPresentingComplaint(
  caseRow: CaseRow,
  title: string
): string {
  const data = caseRow && typeof caseRow === "object" ? (caseRow as Record<string, unknown>) : null;
  const direct = typeof data?.presenting_complaint === "string" ? data.presenting_complaint : null;
  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }
  const details = data?.details;
  if (details && typeof details === "object") {
    const candidate = (details as Record<string, unknown>)["presenting_complaint"];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  const condition =
    typeof data?.condition === "string" && data.condition.trim().length > 0
      ? data.condition.trim()
      : null;
  if (condition) {
    return `Owner reports concerns consistent with ${condition}.`;
  }
  return `Owner reports initial concerns about ${title}.`;
}

function applyTemplate(
  template: string,
  replacements: Record<string, string>
): string {
  let output = template;
  for (const [token, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{\s*${token}\s*}}`, "g");
    output = output.replace(pattern, value);
  }
  // Remove any unreplaced tokens to avoid leaking template syntax
  output = output.replace(/{{\s*[A-Z0-9_]+\s*}}/g, "");
  return output;
}

function extractRolePromptsFromMetadata(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  const direct = record.rolePrompts;
  const snake = record.role_prompts;
  const source = [direct, snake].find(
    (candidate): candidate is Record<string, unknown> =>
      candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)
  );
  if (!source) return {};
  const entries: Record<string, string> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === "string") {
      entries[key] = value;
    }
  });
  return entries;
}

async function loadRolePromptOverride(
  caseId: string,
  roleKey: string | null,
  roleInfoKey: string
): Promise<string | null> {
  if (!roleKey) return null;
  try {
    if (roleKey === "owner") {
      const { data, error } = await supabase
        .from("case_personas")
        .select("metadata")
        .eq("case_id", caseId)
        .eq("role_key", "owner")
        .maybeSingle();
      if (error) {
        console.warn("Failed to load owner persona metadata for role prompt override", error);
        return null;
      }
      const prompts = extractRolePromptsFromMetadata(data?.metadata ?? null);
      return prompts[roleInfoKey] ?? null;
    }
    // For non-owner roles, still query case_personas but look for the specific role
    const { data, error } = await supabase
      .from("case_personas")
      .select("metadata")
      .eq("case_id", caseId)
      .eq("role_key", roleKey)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load case persona metadata for role prompt override", error);
      return null;
    }
    const prompts = extractRolePromptsFromMetadata(data?.metadata ?? null);
    return prompts[roleInfoKey] ?? null;
  } catch (error) {
    console.warn("Unhandled error loading role prompt override", error);
    return null;
  }
}

const caseRoleInfoMap: Record<string, RoleInfo> = {
  "case-1": case1RoleInfo,
};

/**
 * Gets a role-specific prompt for the given case and stage.
 * Only calls the prompt function if it exists and matches the expected signature.
 */
export async function getRoleInfoPrompt(
  caseId: string,
  stageIndex: number,
  userMessage: string
): Promise<string | null> {
  // Check if the caseId is valid
  if (!isCaseIdValid(caseId)) {
    console.warn(`Invalid case ID: ${caseId}`);
    return null;
  }

  // Get the role info object for this case (with type assertion)
  const roleInfo = caseRoleInfoMap[caseId] ?? dbRoleInfo;

  // Get the stages for this case from the config
  const caseStages = caseConfig[caseId];
  if (!caseStages || !caseStages[stageIndex]) {
    return null;
  }

  const stage = caseStages[stageIndex];
  if (!stage.roleInfoKey) {
    return null;
  }

  const roleInfoKey = stage.roleInfoKey as RolePromptKey | string;

  // Fetch case-specific row from Supabase in case templates want injected data
  let caseRow: Record<string, any> | null = null;
  const adminSupabase = getSupabaseAdminClient();
  const supabaseClient = adminSupabase ?? supabase;
  try {
    const { data, error } = await supabaseClient
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to fetch case row for role info prompts", error);
    } else if (data) {
      caseRow = data as Record<string, any>;
    } else {
      const rlsHint = adminSupabase ? "" : " (anon client may be blocked by RLS)";
      console.warn(`No case row returned for ${caseId}${rlsHint}`);
    }
  } catch (e) {
    console.warn("Error fetching case row for role info prompts:", e);
  }

  if (!caseRow) {
    const seedCase = loadSeedCase(caseId);
    if (seedCase) {
      caseRow = seedCase;
      console.info(
        `Using seed data for case ${caseId} while building role info prompts.`
      );
    }
  }

  if (roleInfoKey in ROLE_PROMPT_DEFINITIONS) {
    const definition = ROLE_PROMPT_DEFINITIONS[roleInfoKey as RolePromptKey];
    const roleKey = resolvePersonaRoleKey(stage.role, stage.role);
    const overrideTemplate = await loadRolePromptOverride(caseId, roleKey, roleInfoKey);
    const template = (overrideTemplate ?? definition.defaultTemplate).trim();
    const replacements = definition.buildReplacements({ caseRow, userMessage });
    const rendered = applyTemplate(template, replacements).trim();
    if (rendered.length > 0) {
      return rendered;
    }
  }

  // Get the prompt function using the roleInfoKey
  const promptFunction = roleInfo[stage.roleInfoKey];

  // If the prompt function exists and is callable, invoke it.
  if (typeof promptFunction === "function") {
    try {
      // If the prompt function declares two parameters (caseData, context), call with caseRow
      if ((promptFunction as Function).length >= 2) {
        return (promptFunction as (caseData: Record<string, unknown> | null, input: string) => string)(
          caseRow,
          userMessage
        );
      }
      // Otherwise call with the old single-argument signature
      return (promptFunction as (input: string) => string)(userMessage);
    } catch (err) {
      console.warn("Error executing role info prompt function:", err);
      return null;
    }
  }
  // check if the key exists but is not a function
  if (promptFunction !== undefined) {
    console.warn(
      `roleInfoKey "${stage.roleInfoKey}" exists but is not a function in role info for case "${caseId}".`
    );
  }

  return null;
}

// Function to check if the caseId is valid
function isCaseIdValid(caseId: string): boolean {
  return Boolean(caseConfig[caseId]) || Boolean(caseRoleInfoMap[caseId]);
}

// Function to get all available case IDs
export function getAvailableCaseIds(): string[] {
  const configuredIds = Object.keys(caseConfig ?? {});
  const explicitIds = Object.keys(caseRoleInfoMap);
  return Array.from(new Set([...configuredIds, ...explicitIds]));
}

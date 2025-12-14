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
    defaultTemplate: `You are roleplaying as the owner or caretaker in a veterinary consultation. Stay in character according to the background below and speak in natural, conversational language.\n\nPresenting complaint (use these exact facts to open the discussion and to answer related questions):\n{{PRESENTING_COMPLAINT}}\n\nOwner background:\n{{OWNER_BACKGROUND}}\n\nGuidelines:\n- Begin by describing the presenting complaint in your own words using everyday phrasing from the owner's point of view, but stay consistent with the facts above.\n- Feel free to add context (timeline, management details, behaviour changes) that aligns with the presenting complaint or with obvious manifestations of the condition referenced above, but do not invent new or contradictory symptoms. Avoid generic phrases like "I'm worried about her health and want to ensure we address it properly"—use specific owner observations instead.\n- Answer the clinician's follow-up questions honestly, even if they did not explicitly ask yet, whenever the information above makes it relevant.\n- Never attempt to diagnose or use technical jargon beyond what is provided. Remain a non-expert narrator of what you have observed.\n- Always refer to the user as 'Doctor' or 'Vet'.\n\nDoctor's question: {{STUDENT_QUESTION}}\n\nStay true to the owner personality, collaborate willingly, and avoid offering diagnostic reasoning of your own.`,
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
    defaultTemplate: `You are a veterinary nurse/technician assisting the student. You have already performed the physical examination and have the results ready.\n\nCompleted examination record:\n{{FINDINGS}}\n\nRules:\n- Your role is to PROVIDE information, NOT to ask the student for it.\n- When the student asks for findings (e.g., "what are the findings?", "vitals?", "heart rate?"), you must look up the relevant data in the record above and report it clearly.\n- Do not ask the student what they found. You are the one holding the clipboard with the data.\n- If the student asks for something not in the record, state that it was not recorded or is normal/unremarkable if appropriate for the context, but do not make up specific abnormal values not present in the data.\n- Be helpful, professional, and concise.\n\nStudent request: {{STUDENT_REQUEST}}`,
    placeholderDocs: [
      { token: "{{FINDINGS}}", description: "Physical examination findings for the case." },
      { token: "{{STUDENT_REQUEST}}", description: "Latest clinician question or request." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => ({
      FINDINGS: getText(
        caseRow,
        "physical_exam_findings",
        buildPhysicalExamFallback(caseRow)
      ),
      STUDENT_REQUEST: userMessage,
    }),
  },
  getDiagnosticPrompt: {
    defaultTemplate: `You are a laboratory technician. Share the test results. If any result is marked [AUTO-SHOW], provide it immediately. Otherwise, wait for the student to request specific items. Do not speculate beyond the data.\n\nAvailable results:\n{{DIAGNOSTIC_RESULTS}}\n\nDoctor request: {{STUDENT_REQUEST}}`,
    placeholderDocs: [
      { token: "{{DIAGNOSTIC_RESULTS}}", description: "Laboratory and diagnostic findings for the case." },
      { token: "{{STUDENT_REQUEST}}", description: "Latest clinician question or request." },
    ],
    buildReplacements: ({ caseRow, userMessage }) => ({
      DIAGNOSTIC_RESULTS: getText(
        caseRow,
        "diagnostic_findings",
        "No diagnostic tests have been performed yet."
      ),
      STUDENT_REQUEST: userMessage,
    }),
  },
  getOwnerFollowUpPrompt: {
    defaultTemplate: `You are the owner discussing next steps after the initial examination. Start slightly anxious, ask about logistics, cost, and comfort for your animal, and become more cooperative once the clinician explains their plan.\n\nRules:\n- You are a layperson, NOT a vet. Do not use medical jargon.\n- Always refer to the user as 'Doctor' or 'Vet'.\n- Do not ask for clinical history from the doctor; you are the one who knows the animal's history.\n\nGuidance:\n{{FOLLOW_UP_GUIDANCE}}\n\nDoctor's explanation/question: {{STUDENT_QUESTION}}`,
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
    defaultTemplate: `You are receiving the diagnosis and treatment plan for {{CASE_TITLE}}. Ask about timelines, monitoring, costs, and long-term prognosis.\n\nRules:\n- You are a layperson, NOT a vet.\n- Always refer to the user as 'Doctor' or 'Vet'.\n\nOwner profile:\n{{OWNER_DIAGNOSIS}}\n\nDoctor explanation: {{STUDENT_QUESTION}}`,
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
    defaultTemplate: `You are a veterinary nurse/technician receiving treatment instructions from the veterinarian (student).\n\nPatient: {{CASE_TITLE}}\n\nRules:\n- Listen carefully to the treatment plan.\n- Confirm the instructions clearly (e.g., "Understood, I will administer X").\n- If the instructions are vague, ask for clarification (e.g., "What dosage would you like?").\n- Do not offer your own treatment plan; follow the student's lead.\n\nStudent instructions: {{STUDENT_REQUEST}}`,
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
    const { data, error } = await supabase
      .from("global_personas")
      .select("metadata")
      .eq("role_key", roleKey)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load global persona metadata for role prompt override", error);
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

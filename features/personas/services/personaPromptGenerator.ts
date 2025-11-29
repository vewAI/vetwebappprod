import type OpenAi from "openai";
import type { RolePromptKey } from "@/features/role-info/services/roleInfoService";

export type PersonaRow = {
  id: string;
  case_id?: string | null;
  role_key: string;
  display_name: string | null;
  image_url: string | null;
  prompt: string | null;
  behavior_prompt: string | null;
  metadata: unknown;
};

const MAX_SNIPPET_LENGTH = 1200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringifySnippet(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.length <= MAX_SNIPPET_LENGTH) return value.trim();
    return `${value.trim().slice(0, MAX_SNIPPET_LENGTH)}…`;
  }
  if (Array.isArray(value)) {
    try {
      const serialised = JSON.stringify(value, null, 2);
      return serialised.length <= MAX_SNIPPET_LENGTH
        ? serialised
        : `${serialised.slice(0, MAX_SNIPPET_LENGTH)}…`;
    } catch (error) {
      console.warn("Failed to stringify array snippet", error);
      return "";
    }
  }
  if (isRecord(value)) {
    try {
      const serialised = JSON.stringify(value, null, 2);
      return serialised.length <= MAX_SNIPPET_LENGTH
        ? serialised
        : `${serialised.slice(0, MAX_SNIPPET_LENGTH)}…`;
    } catch (error) {
      console.warn("Failed to stringify object snippet", error);
    }
  }
  return String(value);
}

function extractIdentity(metadata: unknown): Record<string, unknown> | null {
  if (!isRecord(metadata)) return null;
  const identityCandidates = [metadata.identity, metadata.Identity];
  for (const candidate of identityCandidates) {
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function extractRolePromptFromMetadata(metadata: unknown, key: string): string | null {
  if (!isRecord(metadata)) return null;
  const direct = metadata.rolePrompts;
  const snake = metadata.role_prompts;
  const sources = [direct, snake];
  for (const source of sources) {
    if (isRecord(source)) {
      const value = source[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return null;
}

function formatIdentitySummary(identity: Record<string, unknown> | null): string {
  if (!identity) return "None provided.";
  const parts: string[] = [];
  const fullName = typeof identity.fullName === "string" ? identity.fullName : null;
  const firstName = typeof identity.firstName === "string" ? identity.firstName : null;
  const lastName = typeof identity.lastName === "string" ? identity.lastName : null;
  if (fullName) {
    parts.push(`Full name: ${fullName}`);
  } else if (firstName || lastName) {
    parts.push(`Name: ${[firstName, lastName].filter(Boolean).join(" ")}`);
  }
  const honorific = typeof identity.honorific === "string" ? identity.honorific : null;
  if (honorific) {
    parts.push(`Honorific: ${honorific}`);
  }
  const sex = typeof identity.sex === "string" ? identity.sex : null;
  if (sex) {
    parts.push(`Sex: ${sex}`);
  }
  const voiceId = typeof identity.voiceId === "string" ? identity.voiceId : null;
  if (voiceId) {
    parts.push(`Voice ID: ${voiceId}`);
  }
  const pronouns = isRecord(identity.pronouns) ? identity.pronouns : null;
  if (pronouns) {
    const subject = typeof pronouns.subject === "string" ? pronouns.subject : null;
    const object = typeof pronouns.object === "string" ? pronouns.object : null;
    const determiner = typeof pronouns.determiner === "string" ? pronouns.determiner : null;
    const possessive = typeof pronouns.possessive === "string" ? pronouns.possessive : null;
    const fragments = [subject, object, determiner, possessive]
      .filter(Boolean)
      .map((entry) => String(entry));
    if (fragments.length) {
      parts.push(`Pronouns: ${fragments.join(", ")}`);
    }
  }
  if (!parts.length) return "Identity available but no structured fields detected.";
  return parts.join("\n");
}

function formatPersonaSummary(persona: PersonaRow): string {
  const lines: string[] = [];
  lines.push(`Role key: ${persona.role_key}`);
  if (persona.display_name) {
    lines.push(`Display name: ${persona.display_name}`);
  }
  if (persona.prompt) {
    lines.push(`Portrait style prompt (for flavour only):\n${stringifySnippet(persona.prompt)}`);
  }
  const metadata = isRecord(persona.metadata) ? persona.metadata : null;
  if (metadata) {
    const mood = typeof metadata.mood === "string" ? metadata.mood : null;
    const personaDescriptor = typeof metadata.persona === "string" ? metadata.persona : null;
    const sharedKey = typeof metadata.sharedPersonaKey === "string" ? metadata.sharedPersonaKey : null;
    if (sharedKey) {
      lines.push(`Shared persona key: ${sharedKey}`);
    }
    if (personaDescriptor) {
      lines.push(`Persona descriptor: ${personaDescriptor}`);
    }
    if (mood) {
      lines.push(`Mood baseline: ${mood}`);
    }
    const roleNotes = typeof metadata.roleNotes === "string" ? metadata.roleNotes : null;
    if (roleNotes) {
      lines.push(`Additional role notes: ${stringifySnippet(roleNotes)}`);
    }
  }
  const identitySummary = formatIdentitySummary(extractIdentity(metadata));
  if (identitySummary.trim().length) {
    lines.push(`Identity details:\n${identitySummary}`);
  }
  if (persona.behavior_prompt) {
    lines.push(`Existing behavior guidance (for reference only):\n${stringifySnippet(persona.behavior_prompt)}`);
  }
  return lines.join("\n\n");
}

function formatCaseContext(caseRow: Record<string, unknown> | null | undefined): string {
  if (!caseRow) return "No specific case context (shared persona).";
  const lines: string[] = [];
  const addField = (label: string, value: unknown) => {
    if (!value) return;
    const snippet = stringifySnippet(value);
    if (!snippet) return;
    lines.push(`${label}:\n${snippet}`);
  };

  addField("Case title", caseRow.title);
  addField("Species", caseRow.species);
  addField("Condition", caseRow.condition);
  addField("Difficulty", caseRow.difficulty);
  addField("Presenting complaint", caseRow.presenting_complaint ?? caseRow["presentingComplaint"]);
  addField("Owner background", caseRow.owner_background);
  addField("Physical exam findings", caseRow.physical_exam_findings);
  addField("Diagnostic findings", caseRow.diagnostic_findings);
  if (isRecord(caseRow.details)) {
    addField("Case details", caseRow.details);
  }
  addField("Learning objectives", caseRow.learning_objectives ?? caseRow["learningObjectives"]);
  addField("Key communication guidance", caseRow.communication_guidance ?? caseRow["communicationGuidance"]);
  if (!lines.length) {
    return "Case data available but no descriptive fields found.";
  }
  return lines.join("\n\n");
}

type BehaviorPromptInput = {
  openai: OpenAi;
  persona: PersonaRow;
  caseRow?: Record<string, unknown> | null;
};

export async function generateBehaviorPrompt({
  openai,
  persona,
  caseRow,
}: BehaviorPromptInput): Promise<string> {
  const personaSummary = formatPersonaSummary(persona);
  const caseSummary = formatCaseContext(caseRow ?? null);

  const userContent = [
    "Create an updated behavior prompt for the persona described below.",
    "The prompt must equip the AI to roleplay with veterinary or medical students practising history taking, diagnostics, and treatment planning.",
    "Ensure the guidance emphasises coaching students through clinical reasoning while staying inside the persona's knowledge boundaries.",
    "Include directives about tone, when to volunteer information, how to challenge the learner constructively, and how to escalate concerns or redirect when the student misses critical steps.",
    "Output 6-10 concise bullet-style directives or short paragraphs (no markdown fences) that the runtime can inject verbatim.",
    "Avoid referencing hidden tooling or writing meta-commentary—focus on in-character behaviour instructions.",
    "Persona context:",
    personaSummary,
    "Case context:",
    caseSummary,
  ].join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.55,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content:
          "You are an expert veterinary simulation writer. Produce detailed behavioural scripts for personas working with clinical trainees. Respond with plain text only.",
      },
      { role: "user", content: userContent },
    ],
  });

  const generated = response.choices?.[0]?.message?.content?.trim();
  if (!generated) {
    throw new Error("OpenAI returned an empty behavior prompt.");
  }
  return generated;
}

type RolePromptGenerationInput = {
  openai: OpenAi;
  persona: PersonaRow;
  promptKey: RolePromptKey;
  defaultTemplate: string;
  placeholders: { token: string; description: string }[];
  caseRow?: Record<string, unknown> | null;
};

export async function generateRolePromptOverride({
  openai,
  persona,
  promptKey,
  defaultTemplate,
  placeholders,
  caseRow,
}: RolePromptGenerationInput): Promise<string> {
  const personaSummary = formatPersonaSummary(persona);
  const caseSummary = formatCaseContext(caseRow ?? null);
  const placeholderGuidance = placeholders
    .map((entry) => `${entry.token} → ${entry.description}`)
    .join("\n");
  const existingOverride = extractRolePromptFromMetadata(persona.metadata, promptKey);

  const userContent = [
    `Prompt key: ${promptKey}`,
    "Author an override template for this persona's conversation stage.",
    "Requirements:",
    "- Keep the instructions oriented toward helping veterinary learners practise clinical interviewing, diagnostic reasoning, and treatment planning.",
    "- Use the placeholder tokens exactly as provided (brace syntax must remain intact).",
    "- Clarify persona tone, boundaries, when to press the learner for justification, and how to expose case-specific red flags.",
    "- Encourage the persona to coach without giving away final diagnoses unless appropriate for the stage.",
    "- Output a standalone template in plain text (no code fences).",
    "Persona context:",
    personaSummary,
    "Case context:",
    caseSummary,
    "Placeholder tokens (must appear in the output exactly, including braces):",
    placeholderGuidance,
    "Reference default template (use as baseline but feel free to expand with richer guidance):",
    defaultTemplate.trim(),
  ];

  if (existingOverride && existingOverride.trim().length) {
    userContent.push(
      "Existing override (revise or improve upon this if it is already close to ideal):",
      existingOverride.trim()
    );
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You are an expert veterinary education prompt designer. Craft rich, instructive templates for AI standardized clients supporting clinical training. Respond with plain text only.",
      },
      { role: "user", content: userContent.join("\n\n") },
    ],
  });

  const generated = response.choices?.[0]?.message?.content?.trim();
  if (!generated) {
    throw new Error("OpenAI returned an empty role prompt override.");
  }
  return generated;
}

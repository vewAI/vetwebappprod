import type { PromptDefinition } from "./types";
import {
  DEFAULT_DIAGNOSTIC_PROMPT_COPY,
  DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID,
} from "./config/diagnosticPrompts";
import {
  CHAT_SYSTEM_GUIDELINE_DEFAULT,
  CHAT_SYSTEM_GUIDELINE_PROMPT_ID,
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT,
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID,
  PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT,
  PERSONA_TEMPLATE_NURSE_BEHAVIOR_PROMPT_ID,
  createStagePromptDefinitions,
} from "./defaults/personaPrompts";

const diagnosticPrompts: PromptDefinition[] = [
  {
    id: DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID,
    label: "Diagnostic findings • Header",
    description:
      "Opening line displayed before the bullet list of diagnostic results.",
    scope: "defaults",
    category: "defaults",
    defaultValue: DEFAULT_DIAGNOSTIC_PROMPT_COPY.header,
    source: "features/prompts/services/casePromptAutomation.ts",
  },
  {
    id: DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID,
    label: "Diagnostic findings • Closing prefix",
    description:
      "Sentence fragment that appears before the patient's name in the closing reminder.",
    scope: "defaults",
    category: "defaults",
    defaultValue: DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerPrefix,
    source: "features/prompts/services/casePromptAutomation.ts",
  },
  {
    id: DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID,
    label: "Diagnostic findings • Closing suffix",
    description:
      "Sentence fragment that appears after the patient's name in the closing reminder.",
    scope: "defaults",
    category: "defaults",
    defaultValue: DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerSuffix,
    source: "features/prompts/services/casePromptAutomation.ts",
  },
];

const personaManagementPrompts: PromptDefinition[] = [
  {
    id: CHAT_SYSTEM_GUIDELINE_PROMPT_ID,
    label: "Global chat system guideline",
    description:
      "Primary system prompt injected into every conversation. Updates here affect all personas and cases immediately.",
    scope: "system",
    category: "chat",
    defaultValue: CHAT_SYSTEM_GUIDELINE_DEFAULT,
    source: "features/chat/prompts/systemGuideline.ts",
  },
  {
    id: PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID,
    label: "Persona seeding · Owner behaviour template",
    description:
      "Template used when generating or refreshing owner personas. Include placeholder tokens such as {{FULL_NAME}} and {{PATIENT_NAME}}.",
    scope: "global",
    category: "persona",
    defaultValue: PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT,
    source: "features/personas/data/persona-templates.ts",
  },
  {
    id: PERSONA_TEMPLATE_NURSE_BEHAVIOR_PROMPT_ID,
    label: "Persona seeding · Nurse behaviour template",
    description:
      "Template applied to nurse personas during seeding. Supports tokens like {{FULL_NAME}} and {{PERSONALITY}}.",
    scope: "global",
    category: "persona",
    defaultValue: PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT,
    source: "features/personas/data/persona-templates.ts",
  },
  ...createStagePromptDefinitions(),
];

export const promptRegistry: PromptDefinition[] = [
  ...diagnosticPrompts,
  ...personaManagementPrompts,
];

export function findPromptDefinition(id: string): PromptDefinition | undefined {
  return promptRegistry.find((entry) => entry.id === id);
}

export function getPromptsByCase(caseId: string): PromptDefinition[] {
  return promptRegistry.filter((entry) => entry.caseId === caseId);
}

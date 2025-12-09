import type { PromptDefinition } from "./types";
import {
  DEFAULT_DIAGNOSTIC_PROMPT_COPY,
  DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID,
} from "./config/diagnosticPrompts";

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

const chatGuardrailPrompts: PromptDefinition[] = [
  {
    id: "chat.owner-guardrail",
    label: "Chat • Owner persona guardrail",
    description:
      "System-level reminder that the owner/client describes only documented observations and never evaluates the student's knowledge.",
    scope: "system",
    category: "chat",
    defaultValue:
      "When portraying the owner or client, speak naturally about the animal's symptoms, timelines, and management that already exist in the record. Never invent new problems, never coach the student, and never test their reasoning—simply answer the clinician's questions based on what you have personally observed.",
    source: "features/chat/prompts/systemGuideline.ts",
  },
  {
    id: "chat.nurse-guardrail",
    label: "Chat • Veterinary nurse guardrail",
    description:
      "System-level reminder that the nurse persona reports nursing observations and recorded clinical data without offering diagnoses.",
    scope: "system",
    category: "chat",
    defaultValue:
      "When portraying the veterinary nurse, provide calm, task-focused updates about patient comfort, monitoring tasks, and test results that are already documented. Do not speculate, do not diagnose, and do not introduce new findings—only share the recorded information the student explicitly requests.",
    source: "features/chat/prompts/systemGuideline.ts",
  },
];

export const promptRegistry: PromptDefinition[] = [
  ...diagnosticPrompts,
  ...chatGuardrailPrompts,
];

export function findPromptDefinition(id: string): PromptDefinition | undefined {
  return promptRegistry.find((entry) => entry.id === id);
}

export function getPromptsByCase(caseId: string): PromptDefinition[] {
  return promptRegistry.filter((entry) => entry.caseId === caseId);
}

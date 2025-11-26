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

export const promptRegistry: PromptDefinition[] = diagnosticPrompts;

export function findPromptDefinition(id: string): PromptDefinition | undefined {
  return promptRegistry.find((entry) => entry.id === id);
}

export function getPromptsByCase(caseId: string): PromptDefinition[] {
  return promptRegistry.filter((entry) => entry.caseId === caseId);
}

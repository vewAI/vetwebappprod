"use client";

import { useMemo } from "react";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaEntry } from "@/features/chat/hooks/usePersonaDirectory";
import { GEMINI_VOICE_MAP, type PersonaInstruction } from "../types";
import { buildPersonaSystemInstruction } from "../services/systemInstructionBuilder";
import { resolveLivePersonaRoleKey } from "../utils/resolveLivePersonaRoleKey";
import { formatSpeciesKnowledgePrompt, extractSpecializationFromMetadata } from "@/features/personas/services/speciesKnowledgeFormatter";

export function usePersonaSwitcher(
  caseItem: Case | null,
  stages: Stage[],
  currentStageIndex: number,
  personaDirectory: Record<string, PersonaEntry>,
  overrideRoleKey: string | null = null,
): PersonaInstruction | null {
  return useMemo(() => {
    if (!caseItem || stages.length === 0) return null;

    const stage = stages[currentStageIndex];
    if (!stage) return null;

    // Follow the stage by default, unless the user manually selects a persona.
    const personaRoleKey = overrideRoleKey ?? resolveLivePersonaRoleKey(stage);

    // Get persona data from directory
    const personaEntry = personaDirectory[personaRoleKey];

    // Inject owner_background for owner personas
    const ownerBackground = personaRoleKey === "owner" ? caseItem.ownerBackground : undefined;

    // Extract and format species-specific knowledge for nurse/lab personas
    let speciesKnowledge: string | undefined;
    if ((personaRoleKey === "veterinary-nurse" || personaRoleKey === "lab-technician") && personaEntry?.metadata) {
      const spec = extractSpecializationFromMetadata(personaEntry.metadata);
      if (spec) {
        speciesKnowledge = formatSpeciesKnowledgePrompt(spec);
      }
    }

    return buildPersonaSystemInstruction({
      caseItem,
      stage,
      personaRoleKey,
      ownerBackground,
      persona: personaEntry
        ? {
            displayName: personaEntry.displayName,
            portraitUrl: personaEntry.portraitUrl,
            sex: personaEntry.sex,
            behaviorPrompt: personaEntry.behaviorPrompt,
            speciesKnowledge,
            voiceName: personaEntry.sex ? GEMINI_VOICE_MAP[personaEntry.sex] ?? "Aoede" : "Aoede",
          }
        : undefined,
    });
  }, [caseItem, stages, currentStageIndex, personaDirectory, overrideRoleKey]);
}

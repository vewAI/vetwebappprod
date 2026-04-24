"use client";

import { useMemo } from "react";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaEntry } from "@/features/chat/hooks/usePersonaDirectory";
import { STAGE_TYPE_TO_PERSONA, type PersonaInstruction } from "../types";
import { buildPersonaSystemInstruction } from "../services/systemInstructionBuilder";

export function usePersonaSwitcher(
  caseItem: Case | null,
  stages: Stage[],
  currentStageIndex: number,
  personaDirectory: Record<string, PersonaEntry>
): PersonaInstruction | null {
  return useMemo(() => {
    if (!caseItem || stages.length === 0) return null;

    const stage = stages[currentStageIndex];
    if (!stage) return null;

    // Get stage_type from settings
    const settings = stage.settings as Record<string, unknown> | undefined;
    const stageType = typeof settings?.stage_type === "string" ? settings.stage_type : "";

    // Map stage type to persona role key
    const personaRoleKey = stageType
      ? STAGE_TYPE_TO_PERSONA[stageType] ?? "veterinary-nurse"
      : stage.personaRoleKey ?? "veterinary-nurse";

    // Get persona data from directory
    const personaEntry = personaDirectory[personaRoleKey];

    // Inject owner_background for owner personas
    const ownerBackground = personaRoleKey === "owner" ? caseItem.ownerBackground : undefined;

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
          }
        : undefined,
    });
  }, [caseItem, stages, currentStageIndex, personaDirectory]);
}

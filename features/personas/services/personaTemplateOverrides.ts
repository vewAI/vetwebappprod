import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaBehaviorTemplateOverrides } from "@/features/personas/models/persona";
import { resolvePromptValue } from "@/features/prompts/services/promptService";
import {
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT,
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID,
  PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT,
  PERSONA_TEMPLATE_NURSE_BEHAVIOR_PROMPT_ID,
} from "@/features/prompts/defaults/personaPrompts";

const DEFAULT_OVERRIDES: Required<PersonaBehaviorTemplateOverrides> = {
  ownerBehaviorTemplate: PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT,
  nurseBehaviorTemplate: PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT,
};

export async function loadPersonaTemplateOverrides(
  supabase: SupabaseClient
): Promise<Required<PersonaBehaviorTemplateOverrides>> {
  const [ownerBehaviorTemplate, nurseBehaviorTemplate] = await Promise.all([
    resolvePromptValue(
      supabase,
      PERSONA_TEMPLATE_OWNER_BEHAVIOR_PROMPT_ID,
      PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT
    ),
    resolvePromptValue(
      supabase,
      PERSONA_TEMPLATE_NURSE_BEHAVIOR_PROMPT_ID,
      PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT
    ),
  ]);

  return {
    ownerBehaviorTemplate,
    nurseBehaviorTemplate,
  };
}

export function getDefaultPersonaTemplateOverrides(): Required<PersonaBehaviorTemplateOverrides> {
  return { ...DEFAULT_OVERRIDES };
}

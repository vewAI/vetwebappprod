import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaRow } from "@/features/personas/services/personaPromptGenerator";

export type CaseRow = Record<string, unknown> | null;

export async function loadCaseRow(
  supabase: SupabaseClient,
  caseId: string
): Promise<CaseRow> {
  try {
    const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
    if (error) {
      console.error("Failed to load case for persona generation", error);
      return null;
    }
    return (data as Record<string, unknown>) ?? null;
  } catch (error) {
    console.error("Unhandled error loading case for persona generation", error);
    return null;
  }
}

/**
 * Loads a persona row for generation.
 * SIMPLIFIED: Always queries case_personas table - no global_personas dependency.
 */
export async function loadPersonaForGeneration(
  supabase: SupabaseClient,
  options: { roleKey: string; caseId?: string | null }
): Promise<PersonaRow | null> {
  const { roleKey, caseId } = options;

  try {
    // All personas are now case-specific
    if (!caseId) {
      console.warn(`[loadPersonaForGeneration] No caseId provided for role "${roleKey}"`);
      return null;
    }

    const selectColumns =
      "id, case_id, role_key, display_name, image_url, prompt, behavior_prompt, metadata";
    const { data, error } = await supabase
      .from("case_personas")
      .select(selectColumns)
      .eq("case_id", caseId)
      .eq("role_key", roleKey)
      .maybeSingle();

    if (error) {
      console.error(`Failed to load persona "${roleKey}" for case "${caseId}"`, error);
      return null;
    }

    return (data as PersonaRow) ?? null;
  } catch (error) {
    console.error("Unhandled persona fetch error for generation", error);
    return null;
  }
}

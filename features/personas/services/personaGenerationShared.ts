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

export async function loadPersonaForGeneration(
  supabase: SupabaseClient,
  options: { roleKey: string; caseId?: string | null }
): Promise<PersonaRow | null> {
  const { roleKey, caseId } = options;

  try {
    if (roleKey === "owner") {
      if (!caseId) return null;
      const selectColumns =
        "id, case_id, role_key, display_name, image_url, prompt, behavior_prompt, metadata";
      const { data, error } = await supabase
        .from("case_personas")
        .select(selectColumns)
        .eq("case_id", caseId)
        .eq("role_key", roleKey)
        .maybeSingle();
      if (error) {
        console.error("Failed to load owner persona for generation", error);
        return null;
      }
      return (data as PersonaRow) ?? null;
    }

    const selectColumns =
      "id, role_key, display_name, image_url, prompt, behavior_prompt, metadata";
    const { data, error } = await supabase
      .from("global_personas")
      .select(selectColumns)
      .eq("role_key", roleKey)
      .maybeSingle();
    if (error) {
      console.error("Failed to load shared persona for generation", error);
      return null;
    }
    if (!data) return null;
    const persona: PersonaRow = {
      id: data.id as string,
      role_key: data.role_key as string,
      display_name: (data.display_name as string | null) ?? null,
      image_url: (data.image_url as string | null) ?? null,
      prompt: (data.prompt as string | null) ?? null,
      behavior_prompt: (data.behavior_prompt as string | null) ?? null,
      metadata: data.metadata,
      case_id: null,
    };
    return persona;
  } catch (error) {
    console.error("Unhandled persona fetch error for generation", error);
    return null;
  }
}

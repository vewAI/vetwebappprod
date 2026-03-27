import type { SupabaseClient } from "@supabase/supabase-js";
import type { NurseSpecialization } from "@/features/personas/models/nurseSpecialization";
import { normalizeSpeciesKey } from "@/features/cases/services/caseCompletion";

export async function getNurseForSpecies(supabase: SupabaseClient, species?: string | null): Promise<NurseSpecialization | null> {
  if (!species) return null;
  const key = normalizeSpeciesKey(String(species));
  if (!key) return null;

  const { data, error } = await supabase.from("nurse_specializations").select("*").eq("species_key", key).limit(1).maybeSingle();

  if (error) {
    console.error("Failed to fetch nurse specialization", error);
    return null;
  }

  if (!data) return null;

  // Map database fields to the TypeScript model shape
  const mapped: NurseSpecialization = {
    id: data.id,
    speciesKey: data.species_key ?? key,
    displayName: data.display_name ?? "",
    imageUrl: data.image_url ?? null,
    sex: data.sex ?? null,
    voiceId: data.voice_id ?? null,
    behaviorPrompt: data.behavior_prompt ?? "",
    skills: (data.skills as NurseSpecialization["skills"]) ?? [],
    labReferenceRanges: data.lab_reference_ranges ?? null,
    vitalReferenceRanges: data.vital_reference_ranges ?? null,
    commonPathologies: data.common_pathologies ?? null,
    metadata: data.metadata ?? null,
    createdAt: data.created_at ?? undefined,
    updatedAt: data.updated_at ?? undefined,
  };

  return mapped;
}

/**
 * Applies a specialized nurse to a case by upserting a `case_personas` row
 * for role_key = 'veterinary-nurse'. Respects manually edited personas
 * (does not overwrite rows where generated_by === 'manual').
 */
export async function applySpecializedNurse(supabase: SupabaseClient, caseId: string, species?: string | null): Promise<void> {
  if (!caseId) return;
  const nurse = await getNurseForSpecies(supabase, species ?? null);
  if (!nurse) return;

  // Check existing persona for the case
  const { data: existing, error: fetchError } = await supabase
    .from("case_personas")
    .select("generated_by, id")
    .eq("case_id", caseId)
    .eq("role_key", "veterinary-nurse")
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to check existing case persona", fetchError);
    // continue with upsert (best-effort)
  }

  if (existing && existing.generated_by === "manual") {
    // Respect manual edits
    return;
  }

  const metadata: Record<string, unknown> = {
    nurseSpecialization: {
      id: nurse.id,
      speciesKey: nurse.speciesKey,
      skills: nurse.skills,
      labReferenceRanges: nurse.labReferenceRanges,
      vitalReferenceRanges: nurse.vitalReferenceRanges,
      commonPathologies: nurse.commonPathologies,
    },
  };

  const upsertRow = {
    case_id: caseId,
    role_key: "veterinary-nurse",
    display_name: nurse.displayName,
    behavior_prompt: nurse.behaviorPrompt,
    metadata,
    image_url: nurse.imageUrl ?? null,
    status: "ready",
    generated_by: "system",
  };

  const { error: upsertError } = await supabase.from("case_personas").upsert(upsertRow, { onConflict: "case_id,role_key" });

  if (upsertError) {
    console.error("Failed to upsert specialized nurse persona", upsertError);
  }
}

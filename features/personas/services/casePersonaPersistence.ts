import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaSeed } from "@/features/personas/models/persona";
import { buildPersonaSeeds } from "@/features/personas/services/personaSeedService";

type DbPersonaRow = {
  id?: string;
  case_id?: string;
  role_key?: string;
  display_name?: string;
  prompt?: string;
  behavior_prompt?: string;
  status?: string;
  image_url?: string | null;
  metadata?: unknown;
  generated_by?: string;
  last_generated_at?: string | null;
};

/**
 * Ensures case_personas rows exist for a case.
 * 
 * SIMPLIFIED APPROACH (case-only personas):
 * - Each case has its own independent personas in case_personas table
 * - No global_personas dependency - personas are case-specific
 * - If admin selected a source persona (via AvatarSelector), we copy its data
 * - Otherwise we use generated defaults from persona templates
 */
export async function ensureCasePersonas(
  supabase: SupabaseClient,
  caseId: string,
  caseBody: Record<string, unknown>
): Promise<void> {
  const seeds = buildPersonaSeeds(caseId, caseBody);
  if (!seeds.length) return;

  const { data: existingRows, error: fetchError } = await supabase
    .from("case_personas")
    .select(
      "role_key, status, generated_by, display_name, prompt, behavior_prompt, metadata, image_url, last_generated_at"
    )
    .eq("case_id", caseId);

  if (fetchError) {
    console.error("Failed to read existing case personas", fetchError);
    return;
  }

  const existingRoleMap = new Map<string, DbPersonaRow>();
  (existingRows ?? []).forEach((row) => {
    if (row?.role_key) {
      existingRoleMap.set(row.role_key, row);
    }
  });

  // Cache for source personas (when copying from another case's persona)
  const sourcePersonaCache = new Map<string, DbPersonaRow | null>();

  const pendingInserts: DbPersonaRow[] = [];
  const pendingUpdates: Record<string, unknown>[] = [];

  for (const seed of seeds) {
    const existing = existingRoleMap.get(seed.roleKey);
    
    // If a source persona ID was specified (from AvatarSelector), load it to copy data
    const sourcePersona = seed.sharedPersonaKey
      ? await loadSourcePersona(supabase, seed.sharedPersonaKey, sourcePersonaCache)
      : null;

    // Build the persona data - prefer source persona data if available, then existing, then seed defaults
    const displayName = sourcePersona?.display_name ?? existing?.display_name ?? seed.displayName;
    const prompt = sourcePersona?.prompt ?? existing?.prompt ?? seed.prompt;
    const behaviorPrompt = sourcePersona?.behavior_prompt ?? existing?.behavior_prompt ?? seed.behaviorPrompt;
    const imageUrl = seed.imageUrl ?? sourcePersona?.image_url ?? existing?.image_url ?? null;
    const status = imageUrl ? "ready" : (existing?.status ?? "pending");
    
    // Merge metadata
    const mergedMetadata = buildMetadata(sourcePersona?.metadata, existing?.metadata, seed);

    if (!existing) {
      // Insert new persona for this case
      pendingInserts.push({
        case_id: caseId,
        role_key: seed.roleKey,
        display_name: displayName,
        prompt,
        behavior_prompt: behaviorPrompt,
        metadata: mergedMetadata,
        status,
        image_url: imageUrl,
        generated_by: "system",
      });
      continue;
    }

    // Only update if system-managed (respect manual edits)
    const isManuallyEdited = existing.generated_by === "manual";
    if (isManuallyEdited) {
      continue;
    }

    // Update existing persona with new data
    pendingUpdates.push({
      case_id: caseId,
      role_key: seed.roleKey,
      display_name: displayName,
      prompt,
      behavior_prompt: behaviorPrompt,
      metadata: mergedMetadata,
      status,
      image_url: imageUrl,
    });
  }

  if (pendingInserts.length) {
    const { error: insertError } = await supabase
      .from("case_personas")
      .insert(pendingInserts);
    if (insertError) {
      console.error("Failed to insert case personas", insertError);
    }
  }

  if (pendingUpdates.length) {
    const { error: updateError } = await supabase
      .from("case_personas")
      .upsert(pendingUpdates, { onConflict: "case_id,role_key" });
    if (updateError) {
      console.error("Failed to update case personas", updateError);
    }
  }
}

/**
 * Load a source persona to copy data from.
 * Format: "case:{uuid}" - references a case_personas row by ID
 * Legacy: plain string - search by role_key in case_personas
 */
async function loadSourcePersona(
  supabase: SupabaseClient,
  sourceKey: string,
  cache: Map<string, DbPersonaRow | null>
): Promise<DbPersonaRow | null> {
  if (cache.has(sourceKey)) {
    return cache.get(sourceKey) ?? null;
  }

  // Format: "case:{uuid}" - direct lookup by ID
  if (sourceKey.startsWith("case:")) {
    const personaId = sourceKey.slice(5);
    const { data, error } = await supabase
      .from("case_personas")
      .select(
        "id, case_id, role_key, display_name, prompt, behavior_prompt, status, image_url, metadata"
      )
      .eq("id", personaId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load source persona by ID", error);
      cache.set(sourceKey, null);
      return null;
    }

    cache.set(sourceKey, data ?? null);
    return data ?? null;
  }

  // Legacy format: "global:{uuid}" - still supported for backwards compatibility
  // but now looks in case_personas instead of global_personas
  if (sourceKey.startsWith("global:")) {
    // For legacy global references, we just skip - no global table lookup
    console.warn(`Legacy global persona reference ignored: ${sourceKey}`);
    cache.set(sourceKey, null);
    return null;
  }

  // Legacy fallback: search by role_key (for old data)
  const { data, error } = await supabase
    .from("case_personas")
    .select(
      "id, case_id, role_key, display_name, prompt, behavior_prompt, status, image_url, metadata"
    )
    .eq("role_key", sourceKey)
    .not("image_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Failed to load source persona by role_key", error);
    cache.set(sourceKey, null);
    return null;
  }

  const row = data?.[0] ?? null;
  cache.set(sourceKey, row);
  return row;
}

/**
 * Build merged metadata for a persona
 */
function buildMetadata(
  sourceMetadata: unknown,
  existingMetadata: unknown,
  seed: PersonaSeed
): Record<string, unknown> | null {
  const source = toRecord(sourceMetadata);
  const existing = toRecord(existingMetadata);
  const seedMeta = seed.metadata ?? {};

  const merged: Record<string, unknown> = {
    ...(source ?? {}),
    ...(existing ?? {}),
    ...seedMeta,
  };

  // Preserve identity from seed (generated based on case context)
  if (seedMeta.identity) {
    merged.identity = seedMeta.identity;
  }
  if (seedMeta.sex) {
    merged.sex = seedMeta.sex;
  }
  if (seedMeta.voiceId) {
    merged.voiceId = seedMeta.voiceId;
  }

  // Track source if we copied from another persona
  if (seed.sharedPersonaKey) {
    merged.copiedFrom = seed.sharedPersonaKey;
  }

  return Object.keys(merged).length ? merged : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

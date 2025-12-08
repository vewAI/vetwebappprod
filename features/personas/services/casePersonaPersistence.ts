import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaSeed } from "@/features/personas/models/persona";
import { buildPersonaSeeds } from "@/features/personas/services/personaSeedService";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";
import {
  getDefaultPersonaTemplateOverrides,
  loadPersonaTemplateOverrides,
} from "@/features/personas/services/personaTemplateOverrides";

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

export async function ensureCasePersonas(
  supabase: SupabaseClient,
  caseId: string,
  caseBody: Record<string, unknown>
): Promise<void> {
  await ensureSharedPersonas(supabase);

  let overrides = getDefaultPersonaTemplateOverrides();
  try {
    overrides = await loadPersonaTemplateOverrides(supabase);
  } catch (error) {
    console.warn("Failed to load persona template overrides for case personas; using defaults", error);
  }

  const seeds = buildPersonaSeeds(caseId, caseBody, overrides);
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

  const sharedPersonaCache = new Map<string, DbPersonaRow | null>();

  const pendingInserts: DbPersonaRow[] = [];
  const pendingUpdates: Record<string, unknown>[] = [];

  for (const seed of seeds) {
    const existing = existingRoleMap.get(seed.roleKey);
    const sharedPersona = seed.sharedPersonaKey
      ? await loadSharedPersona(
          supabase,
          caseId,
          seed.roleKey,
          seed.sharedPersonaKey,
          sharedPersonaCache
        )
      : null;

    const mergedMetadata = mergeMetadata(sharedPersona?.metadata, seed);
    const displayName = sharedPersona?.display_name ?? seed.displayName;
    const prompt = sharedPersona?.prompt ?? seed.prompt;
    const behaviorPrompt =
      sharedPersona?.behavior_prompt ?? existing?.behavior_prompt ?? seed.behaviorPrompt;
    const imageUrl = resolveImageUrl(existing, sharedPersona);
    const status = resolveStatus(existing, sharedPersona, imageUrl);

    if (!existing) {
      pendingInserts.push({
        case_id: caseId,
        role_key: seed.roleKey,
        display_name: displayName,
        prompt,
        behavior_prompt: behaviorPrompt,
        metadata: mergedMetadata ?? null,
        status,
        image_url: imageUrl ?? null,
        generated_by: "system",
      });
      continue;
    }

    const autoManaged = !existing.generated_by || existing.generated_by === "system";
    if (!autoManaged) {
      continue;
    }

    const updatePayload: Record<string, unknown> = {
      case_id: caseId,
      role_key: seed.roleKey,
      display_name: displayName,
      prompt,
      behavior_prompt: behaviorPrompt,
      metadata: mergedMetadata ?? null,
      status,
      image_url: imageUrl ?? null,
    };

    pendingUpdates.push(updatePayload);
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
      console.error("Failed to refresh persona prompts", updateError);
    }
  }
}

async function loadSharedPersona(
  supabase: SupabaseClient,
  caseId: string,
  roleKey: string,
  sharedPersonaKey: string,
  cache: Map<string, DbPersonaRow | null>
): Promise<DbPersonaRow | null> {
  const cacheKey = `${roleKey}:${sharedPersonaKey}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const { data, error } = await supabase
    .from("case_personas")
    .select(
      "id, case_id, role_key, display_name, prompt, behavior_prompt, status, image_url, metadata, last_generated_at"
    )
    .eq("role_key", roleKey)
    .eq("metadata->>sharedPersonaKey", sharedPersonaKey)
    .neq("case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Failed to load shared persona", error);
    cache.set(cacheKey, null);
    return null;
  }

  const row = data?.[0] ?? null;
  cache.set(cacheKey, row ?? null);
  return row ?? null;
}

function mergeMetadata(
  sharedMetadata: unknown,
  seed: PersonaSeed
): Record<string, unknown> | null {
  const shared = toRecord(sharedMetadata);
  const base = seed.metadata ?? {};
  const merged = {
    ...(shared ?? {}),
    ...base,
  };
  if (seed.sharedPersonaKey) {
    merged.sharedPersonaKey = seed.sharedPersonaKey;
  }
  return merged;
}

function resolveImageUrl(
  existing: DbPersonaRow | undefined,
  sharedPersona: DbPersonaRow | null
): string | null {
  if (sharedPersona?.image_url) {
    return sharedPersona.image_url;
  }
  if (existing?.image_url) {
    return existing.image_url;
  }
  return null;
}

function resolveStatus(
  existing: DbPersonaRow | undefined,
  sharedPersona: DbPersonaRow | null,
  imageUrl: string | null | undefined
): string {
  if (sharedPersona?.status) {
    return sharedPersona.status;
  }
  if (existing?.status && existing.status !== "failed") {
    return existing.status;
  }
  if (imageUrl) {
    return "ready";
  }
  return "pending";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

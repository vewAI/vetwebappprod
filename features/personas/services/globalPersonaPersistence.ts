import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaSeed } from "@/features/personas/models/persona";
import { buildSharedPersonaSeeds } from "@/features/personas/services/personaSeedService";

export type GlobalPersonaRow = {
  id?: string;
  role_key?: string | null;
  display_name?: string | null;
  prompt?: string | null;
  behavior_prompt?: string | null;
  status?: string | null;
  image_url?: string | null;
  metadata?: unknown;
  generated_by?: string | null;
  last_generated_at?: string | null;
};

const MANUAL_FLAG = "manual";

export async function ensureSharedPersonas(
  supabase: SupabaseClient
): Promise<void> {
  const seeds = buildSharedPersonaSeeds();
  for (const seed of seeds) {
    await ensureSharedPersona(supabase, seed);
  }
}

export async function ensureSharedPersona(
  supabase: SupabaseClient,
  seed: PersonaSeed
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("global_personas")
    .select(
      "id, role_key, display_name, prompt, behavior_prompt, metadata, generated_by"
    )
    .eq("role_key", seed.roleKey)
    .maybeSingle();

  if (error) {
    console.error("Failed to read global persona", {
      roleKey: seed.roleKey,
      error: error.message,
    });
    return;
  }

  const metadata = normalizeMetadata(existing?.metadata, seed);

  if (!existing) {
    const insertPayload = {
      role_key: seed.roleKey,
      display_name: seed.displayName,
      prompt: seed.prompt,
      behavior_prompt: seed.behaviorPrompt,
      metadata,
      generated_by: "system",
    } satisfies Record<string, unknown>;

    const { error: insertError } = await supabase
      .from("global_personas")
      .insert(insertPayload);

    if (insertError) {
      console.error("Failed to insert global persona", insertError);
    }
    return;
  }

  const autoManaged = !existing.generated_by || existing.generated_by === "system";
  if (!autoManaged) return;

  const updatePayload = {
    display_name: seed.displayName,
    prompt: seed.prompt,
    behavior_prompt: seed.behaviorPrompt,
    metadata,
  } satisfies Record<string, unknown>;

  const { error: updateError } = await supabase
    .from("global_personas")
    .update(updatePayload)
    .eq("id", existing.id);

  if (updateError) {
    console.error("Failed to update global persona", updateError);
  }
}

function normalizeMetadata(
  stored: unknown,
  seed: PersonaSeed
): Record<string, unknown> | null {
  const storedRecord =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : null;

  const next: Record<string, unknown> = {
    ...(storedRecord ?? {}),
    ...(seed.metadata ?? {}),
  };

  if (seed.metadata?.identity) {
    next.identity = seed.metadata.identity;
  }
  if (seed.metadata?.voiceId) {
    next.voiceId = seed.metadata.voiceId;
  }
  if (seed.metadata?.sex) {
    next.sex = seed.metadata.sex;
  }
  if (seed.sharedPersonaKey) {
    next.sharedPersonaKey = seed.sharedPersonaKey;
  }

  return Object.keys(next).length ? next : null;
}

export function isManualPersona(row: GlobalPersonaRow | null | undefined): boolean {
  if (!row) return false;
  const flag = row.generated_by;
  return typeof flag === "string" && flag.trim().toLowerCase() === MANUAL_FLAG;
}

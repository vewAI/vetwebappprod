function shouldFallbackToDalle3(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const anyErr = error as { status?: number; message?: unknown; error?: unknown };
  if (typeof anyErr.status === "number" && anyErr.status === 403) {
    return true;
  }
  const messageCandidate =
    typeof anyErr.message === "string"
      ? anyErr.message
      : typeof anyErr.error === "object" && anyErr.error !== null
        ? (anyErr.error as { message?: unknown }).message
        : undefined;
  if (typeof messageCandidate === "string") {
    return messageCandidate.includes("must be verified")
      || messageCandidate.includes("Unknown parameter: 'response_format'");
  }
  return false;
}
import { Buffer } from "buffer";
import type OpenAi from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";
import type {
  PersonaIdentity,
  PersonaSex,
} from "@/features/personas/models/persona";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { resolvePersonaIdentity } from "@/features/personas/services/personaIdentityService";

/** Constant for legacy global persona code - will be removed */
const SHARED_CASE_ID = "shared";

const DEFAULT_BUCKET =
  process.env.PERSONA_IMAGE_BUCKET ??
  process.env.NEXT_PUBLIC_PERSONA_IMAGE_BUCKET ??
  "persona-images";
const IMAGE_MODEL = process.env.PERSONA_IMAGE_MODEL ?? "dall-e-3";
type PersonaImageSize =
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "1024x1792"
  | "1792x1024"
  | "auto";
const envImageSize = process.env.PERSONA_IMAGE_SIZE;
const ALLOWED_IMAGE_SIZES: PersonaImageSize[] = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
  "auto",
];
const DEFAULT_IMAGE_SIZE: PersonaImageSize = "1024x1024";
const IMAGE_SIZE: PersonaImageSize = ALLOWED_IMAGE_SIZES.includes(
  envImageSize as PersonaImageSize
)
  ? (envImageSize as PersonaImageSize)
  : "1024x1024";

interface CasePersonaRow {
  id?: string;
  case_id?: string | null;
  role_key?: string | null;
  display_name?: string | null;
  prompt?: string | null;
  behavior_prompt?: string | null;
  status?: string | null;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  generated_by?: string | null;
  last_generated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GlobalPersonaRow {
  id?: string;
  role_key?: string | null;
  display_name?: string | null;
  prompt?: string | null;
  behavior_prompt?: string | null;
  status?: string | null;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  generated_by?: string | null;
  last_generated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface GlobalPersonaSummaryRow {
  role_key?: string | null;
  display_name?: string | null;
  status?: string | null;
  image_url?: string | null;
}

type PersonaMetadata = {
  identity?: PersonaIdentity;
  sex?: PersonaSex;
  voiceId?: string;
  persona?: string;
  error?: string;
  [key: string]: unknown;
} | null;

type PersonaPortraitArgs = {
  supabase: SupabaseClient;
  openai: OpenAi;
  caseId: string;
  stageRole?: string | null;
  displayRole?: string | null;
  force?: boolean;
};

type PersonaPortraitResult = {
  imageUrl?: string;
  roleKey?: string;
  displayName?: string;
  voiceId?: string;
  sex?: PersonaSex;
  identity?: PersonaIdentity;
};

type GlobalPortraitArgs = {
  supabase: SupabaseClient;
  openai: OpenAi;
  roleKey: string;
  displayRole?: string | null;
  stageRole?: string | null;
  force?: boolean;
};

type GlobalPortraitOptions = {
  roleKey?: string;
  force?: boolean;
};

async function getGlobalPersonaPortrait({
  supabase,
  openai,
  roleKey,
  displayRole,
  stageRole,
  force,
}: GlobalPortraitArgs): Promise<PersonaPortraitResult> {
  let personaRow = await ensureGlobalPersonaRowExists(supabase, roleKey);
  if (!personaRow) {
    return { roleKey };
  }

  const personaMetadata = parsePersonaMetadata(personaRow);
  const identity =
    personaMetadata?.identity ?? resolvePersonaIdentity(SHARED_CASE_ID, roleKey);
  const voiceId = (personaMetadata?.voiceId ??
    personaMetadata?.identity?.voiceId ??
    identity?.voiceId) as string | undefined;
  const personaSex = (personaMetadata?.sex ??
    personaMetadata?.identity?.sex ??
    identity?.sex) as PersonaSex | undefined;
  const displayName =
    personaRow.display_name ??
    identity?.fullName ??
    displayRole ??
    stageRole ??
    roleKey;

  let personaBehaviorPrompt: string | undefined;
  if (personaRow.behavior_prompt && typeof personaRow.behavior_prompt === "string") {
    const trimmed = personaRow.behavior_prompt.trim();
    if (trimmed) {
      personaBehaviorPrompt = trimmed;
    }
  }
  if (!personaBehaviorPrompt && personaMetadata) {
    const behaviorCandidate = personaMetadata["behaviorPrompt"];
    if (typeof behaviorCandidate === "string") {
      const trimmed = behaviorCandidate.trim();
      if (trimmed) {
        personaBehaviorPrompt = trimmed;
      }
    }
  }

  if (personaBehaviorPrompt) {
    // Store behaviour prompt back onto the row for future retrieval if missing.
    if (!personaRow.behavior_prompt && personaRow.id) {
      void supabase
        .from("global_personas")
        .update({ behavior_prompt: personaBehaviorPrompt })
        .eq("id", personaRow.id)
        .then(
          () => undefined,
          () => undefined
        );
    }
  }

  if (!force && personaRow.image_url && personaRow.status === "ready") {
    const existingIdentity = (personaMetadata?.identity ?? identity) as
      | PersonaIdentity
      | undefined;
    return {
      imageUrl: personaRow.image_url,
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity: existingIdentity,
    };
  }

  const sharedPersonaKey =
    personaMetadata && typeof personaMetadata["sharedPersonaKey"] === "string"
      ? (personaMetadata["sharedPersonaKey"] as string)
      : roleKey;

  const promptText =
    personaRow.prompt ?? buildFallbackPrompt(roleKey, displayRole ?? stageRole);
  if (!promptText) {
    return {
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity,
    };
  }

  let modelUsed: string = IMAGE_MODEL;
  let sizeUsed: PersonaImageSize = normalizeImageSize(IMAGE_MODEL, IMAGE_SIZE);

  try {
    await markGlobalPersonaStatus(supabase, personaRow, roleKey, "generating");

    const requestPayload: Parameters<typeof openai.images.generate>[0] = {
      model: IMAGE_MODEL,
      prompt: promptText,
      n: 1,
      size: sizeUsed,
    };
    modelUsed = requestPayload.model ?? IMAGE_MODEL;

    if (IMAGE_MODEL !== "gpt-image-1") {
      requestPayload.response_format = "b64_json";
    }

    let currentPayload = { ...requestPayload };
    let allowSizeRetry = true;
    let allowFallback = IMAGE_MODEL === "gpt-image-1";
    let response;

    while (true) {
      try {
        response = await openai.images.generate(currentPayload, { timeout: 60000 }); // Increase timeout to 60s
        modelUsed = currentPayload.model ?? IMAGE_MODEL;
        if (typeof currentPayload.size === "string") {
          sizeUsed = normalizeImageSize(
            modelUsed,
            currentPayload.size as PersonaImageSize
          );
        }
        break;
      } catch (generationError) {
        if (
          allowSizeRetry &&
          shouldRetryWithDefaultSize(generationError, currentPayload.size)
        ) {
          currentPayload = {
            ...currentPayload,
            size: DEFAULT_IMAGE_SIZE,
          };
          sizeUsed = DEFAULT_IMAGE_SIZE;
          allowSizeRetry = false;
          continue;
        }

        if (allowFallback && shouldFallbackToDalle3(generationError)) {
          currentPayload = {
            ...currentPayload,
            model: "dall-e-3",
            response_format: "b64_json",
            size: normalizeImageSize(
              "dall-e-3",
              currentPayload.size as PersonaImageSize
            ),
          };
          modelUsed = "dall-e-3";
          sizeUsed = currentPayload.size as PersonaImageSize;
          allowFallback = false;
          continue;
        }

        throw generationError;
      }
    }

    const b64 = (response as any).data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Image generation returned no data");
    }

    const buffer = Buffer.from(b64, "base64");
    const fileName = `${sharedPersonaKey}.png`;
    const storagePath = `shared/${fileName}`;
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    const { error: uploadError } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(DEFAULT_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      throw new Error("Failed to resolve public URL for persona portrait");
    }

    const nextMetadata: Record<string, unknown> = {
      ...(personaMetadata ?? {}),
      identity,
      voiceId,
      sex: personaSex,
      sharedPersonaKey,
      generatedAt: new Date().toISOString(),
      model: modelUsed,
      size: sizeUsed,
    };

    await markGlobalPersonaStatus(supabase, personaRow, roleKey, "ready", {
      image_url: publicUrl,
      last_generated_at: new Date().toISOString(),
      display_name: displayName,
      prompt: promptText,
      behavior_prompt: personaBehaviorPrompt ?? null,
      generated_by: personaRow.generated_by ?? "system",
      metadata: nextMetadata,
    });

    personaRow =
      (await fetchGlobalPersonaRow(supabase, roleKey)) ?? personaRow;
    const refreshedMetadata = parsePersonaMetadata(personaRow);
    const refreshedVoiceId = (refreshedMetadata?.voiceId ??
      refreshedMetadata?.identity?.voiceId ??
      voiceId) as string | undefined;
    const refreshedSex = (refreshedMetadata?.sex ??
      refreshedMetadata?.identity?.sex ??
      personaSex) as PersonaSex | undefined;
    const refreshedDisplayName = personaRow?.display_name ?? displayName;
    const refreshedIdentity = (refreshedMetadata?.identity ?? identity) as
      | PersonaIdentity
      | undefined;

    return {
      imageUrl: publicUrl,
      roleKey,
      displayName: refreshedDisplayName,
      voiceId: refreshedVoiceId,
      sex: refreshedSex,
      identity: refreshedIdentity,
    };
  } catch (error) {
    console.error("Failed to generate global persona portrait", error);
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    const failureMetadata: Record<string, unknown> = {
      ...(personaMetadata ?? {}),
      identity,
      voiceId,
      sex: personaSex,
      error: errorMessage,
      failedAt: new Date().toISOString(),
      model: modelUsed,
      sizeTried: sizeUsed,
      sharedPersonaKey,
    };
    await markGlobalPersonaStatus(supabase, personaRow, roleKey, "failed", {
      prompt: promptText,
      metadata: failureMetadata,
    });
    return {
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity,
    };
  }
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "object") {
    const candidate = (error as { message?: unknown; error?: unknown }).message;
    if (typeof candidate === "string") return candidate;
    const nested = (error as { error?: { message?: unknown } }).error;
    if (nested && typeof nested === "object") {
      const nestedMessage = (nested as { message?: unknown }).message;
      if (typeof nestedMessage === "string") return nestedMessage;
    }
  }
  return null;
}

function shouldRetryWithDefaultSize(error: unknown, currentSize?: unknown): boolean {
  const message = extractErrorMessage(error);
  if (!message) return false;
  if (typeof currentSize === "string" && currentSize === DEFAULT_IMAGE_SIZE) {
    return false;
  }
  if (message.includes("Invalid value") && message.includes("512x512")) {
    return true;
  }
  if (message.includes("Supported values are") && !message.includes(DEFAULT_IMAGE_SIZE)) {
    return true;
  }
  return false;
}

function normalizeImageSize(model: string, requested?: PersonaImageSize): PersonaImageSize {
  const size = requested && ALLOWED_IMAGE_SIZES.includes(requested)
    ? requested
    : DEFAULT_IMAGE_SIZE;

  if (model === "dall-e-3") {
    if (size === "auto") return size;
    if (size === "1024x1024" || size === "1024x1536" || size === "1536x1024" || size === "1024x1792" || size === "1792x1024") {
      return size;
    }
    return DEFAULT_IMAGE_SIZE;
  }

  if (size === "auto") {
    return DEFAULT_IMAGE_SIZE;
  }

  return size;
}

export function resolvePersonaRoleKey(
  stageRole?: string | null,
  displayRole?: string | null
): string | null {
  const sourceRaw = stageRole ?? displayRole ?? "";
  const source = sourceRaw.trim();
  if (!source) return null;
  const lower = source.toLowerCase();

  // Owner/Client roles → owner persona
  if (lower.includes("owner") || lower.includes("client")) return "owner";
  
  // All other clinical staff roles → veterinary-nurse persona
  // This includes: nurse, technician, lab technician, assistant, etc.
  // Each case has only ONE nurse persona that handles all non-owner stages
  if (
    lower.includes("nurse") ||
    lower.includes("technician") ||
    lower.includes("lab") ||
    lower.includes("assistant")
  ) {
    return "veterinary-nurse";
  }
  
  // Producer/Farmer → owner persona (they own the animal)
  if (lower.includes("producer") || lower.includes("farmer")) return "owner";
  
  // Professor/Faculty roles are special - they don't get case personas
  if (lower.includes("professor") || lower.includes("faculty") || lower.includes("mentor")) {
    return null;
  }
  
  // Veterinarian role - typically this is the student, not a persona
  if (lower.includes("veterinarian") || lower.includes("vet")) {
    return null;
  }

  // Unknown role - default to nurse for clinical staff
  return "veterinary-nurse";
}

type PersonaSummaryRow = {
  role_key?: string | null;
  display_name?: string | null;
  status?: string | null;
  image_url?: string | null;
};

function buildFallbackPrompt(roleKey: string, label?: string | null): string | null {
  const humanLabel = label?.trim() || roleKey.replace(/-/g, " ");
  const prompts: Record<string, string> = {
    owner:
      "Photorealistic portrait of a caring animal owner standing beside a stable gate, natural warm lighting, shallow depth of field, expressive eyes, professional color grading.",
    "lab-technician":
      "Photorealistic portrait of a veterinary laboratory technician in a diagnostics lab, cool ambient lighting, microscopes blurred in background, clean lab coat, cinematic realism.",
    veterinarian:
      "Photorealistic portrait of a calm veterinarian in a clinic exam room, stethoscope in hand, balanced soft lighting, confident yet approachable expression, high detail.",
    "veterinary-nurse":
      "Photorealistic portrait of a veterinary nurse in scrubs within a treatment area, gentle smile, caring demeanor, diffused daylight, cinematic depth.",
    producer:
      "Photorealistic portrait of a dairy producer on a modern farm lane, warm sunrise lighting, barn silhouettes in soft focus, practical workwear, grounded realism.",
    "veterinary-assistant":
      "Photorealistic portrait of a veterinary assistant in a hospital prep room, clipboard in hand, neutral lighting with soft highlights, supportive expression, realistic detail.",
    professor:
      "Photorealistic portrait of a veterinary professor inside a lecture hall, warm overhead lighting, shelves of clinical texts blurred behind, thoughtful expression, cinematic clarity.",
  };

  if (prompts[roleKey]) {
    return prompts[roleKey];
  }

  if (humanLabel) {
    return `Photorealistic portrait of ${humanLabel}, soft cinematic lighting, shallow depth of field, professional color grading.`;
  }

  return null;
}

async function fetchPersonaRow(
  supabase: SupabaseClient,
  caseId: string,
  roleKey: string
): Promise<CasePersonaRow | null> {
  const { data, error } = await supabase
    .from("case_personas")
    .select(
      "id, case_id, role_key, display_name, prompt, status, image_url, metadata, generated_by, last_generated_at, created_at, updated_at"
    )
    .eq("case_id", caseId)
    .eq("role_key", roleKey)
    .maybeSingle();

  if (error) {
    console.warn("Failed to read persona row", error);
    return null;
  }

  return data ?? null;
}

function parsePersonaMetadata(
  row: CasePersonaRow | GlobalPersonaRow | null
): PersonaMetadata {
  if (!row?.metadata || typeof row.metadata !== "object") {
    return null;
  }
  return row.metadata as PersonaMetadata;
}

async function ensurePersonaRowExists(
  supabase: SupabaseClient,
  caseId: string,
  roleKey: string
): Promise<CasePersonaRow | null> {
  const existing = await fetchPersonaRow(supabase, caseId, roleKey);
  if (existing) return existing;

  const { data: caseRecord, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch case for persona seeding", error);
    return null;
  }

  if (!caseRecord) {
    return null;
  }

  await ensureCasePersonas(
    supabase,
    caseId,
    caseRecord as Record<string, unknown>
  );

  return await fetchPersonaRow(supabase, caseId, roleKey);
}

async function fetchGlobalPersonaRow(
  supabase: SupabaseClient,
  roleKey: string
): Promise<GlobalPersonaRow | null> {
  const { data, error } = await supabase
    .from("global_personas")
    .select(
      "id, role_key, display_name, prompt, behavior_prompt, status, image_url, metadata, generated_by, last_generated_at, created_at, updated_at"
    )
    .eq("role_key", roleKey)
    .maybeSingle();

  if (error) {
    console.warn("Failed to read global persona row", error);
    return null;
  }

  return data ?? null;
}

/**
 * @deprecated Global personas are no longer used
 */
async function ensureGlobalPersonaRowExists(
  _supabase: SupabaseClient,
  roleKey: string
): Promise<GlobalPersonaRow | null> {
  console.warn(`[DEPRECATED] ensureGlobalPersonaRowExists called for "${roleKey}" - global personas are deprecated`);
  return null;
}

async function markGlobalPersonaStatus(
  supabase: SupabaseClient,
  row: GlobalPersonaRow | null,
  roleKey: string,
  status: "pending" | "generating" | "ready" | "failed",
  extra: Partial<GlobalPersonaRow> = {}
) {
  const payload: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (row?.id) {
    await supabase.from("global_personas").update(payload).eq("id", row.id);
    return;
  }

  await supabase
    .from("global_personas")
    .upsert(
      {
        role_key: roleKey,
        ...payload,
      },
      { onConflict: "role_key" }
    );
}

async function markPersonaStatus(
  supabase: SupabaseClient,
  row: CasePersonaRow | null,
  caseId: string,
  roleKey: string,
  status: "pending" | "generating" | "ready" | "failed",
  extra: Partial<CasePersonaRow> = {}
) {
  const payload: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (row?.id) {
    await supabase.from("case_personas").update(payload).eq("id", row.id);
    return;
  }

  await supabase
    .from("case_personas")
    .upsert(
      {
        case_id: caseId,
        role_key: roleKey,
        ...payload,
      },
      { onConflict: "case_id,role_key" }
    );
}

/**
 * Gets or generates a persona portrait for a case-specific persona.
 * SIMPLIFIED: All personas are now case-specific - no global_personas routing.
 */
export async function getOrGeneratePersonaPortrait({
  supabase,
  openai,
  caseId,
  stageRole,
  displayRole,
  force,
}: PersonaPortraitArgs): Promise<PersonaPortraitResult> {
  const roleKey = resolvePersonaRoleKey(stageRole, displayRole);
  if (!roleKey) return {};

  // All personas now use case-specific storage
  let personaRow = await ensurePersonaRowExists(supabase, caseId, roleKey);
  const personaMetadata = parsePersonaMetadata(personaRow);
  const sharedPersonaKey =
    typeof personaMetadata?.sharedPersonaKey === "string"
      ? personaMetadata.sharedPersonaKey
      : `${caseId}-${roleKey}`;
  const identity =
    personaMetadata?.identity ?? resolvePersonaIdentity(caseId, roleKey);
  const voiceId = (personaMetadata?.voiceId ??
    personaMetadata?.identity?.voiceId ??
    identity?.voiceId) as string | undefined;
  const personaSex = (personaMetadata?.sex ??
    personaMetadata?.identity?.sex ??
    identity?.sex) as PersonaSex | undefined;
  const displayName =
    personaRow?.display_name ??
    identity?.fullName ??
    displayRole ??
    stageRole ??
    roleKey;

  if (!force && personaRow?.image_url && personaRow.status === "ready") {
    const existingIdentity = (personaMetadata?.identity ?? identity) as
      | PersonaIdentity
      | undefined;
    return {
      imageUrl: personaRow.image_url,
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity: existingIdentity,
    };
  }

  const promptText =
    personaRow?.prompt ?? buildFallbackPrompt(roleKey, displayRole ?? stageRole);
  if (!promptText) {
    return {
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity,
    };
  }

  let modelUsed: string = IMAGE_MODEL;
  let sizeUsed: PersonaImageSize = normalizeImageSize(IMAGE_MODEL, IMAGE_SIZE);
  try {
    await markPersonaStatus(supabase, personaRow, caseId, roleKey, "generating");

    const requestPayload: Parameters<typeof openai.images.generate>[0] = {
      model: IMAGE_MODEL,
      prompt: promptText,
      n: 1,
      size: sizeUsed,
    };
    modelUsed = requestPayload.model ?? IMAGE_MODEL;

    if (IMAGE_MODEL !== "gpt-image-1") {
      requestPayload.response_format = "b64_json";
    }

    let currentPayload = { ...requestPayload };
    let allowSizeRetry = true;
    let allowFallback = IMAGE_MODEL === "gpt-image-1";
    let response;

    while (true) {
      try {
        response = await openai.images.generate(currentPayload);
        modelUsed = currentPayload.model ?? IMAGE_MODEL;
        if (typeof currentPayload.size === "string") {
          sizeUsed = normalizeImageSize(modelUsed, currentPayload.size as PersonaImageSize);
        }
        break;
      } catch (generationError) {
        if (allowSizeRetry && shouldRetryWithDefaultSize(generationError, currentPayload.size)) {
          currentPayload = {
            ...currentPayload,
            size: DEFAULT_IMAGE_SIZE,
          };
          sizeUsed = DEFAULT_IMAGE_SIZE;
          allowSizeRetry = false;
          continue;
        }

        if (allowFallback && shouldFallbackToDalle3(generationError)) {
          currentPayload = {
            ...currentPayload,
            model: "dall-e-3",
            response_format: "b64_json",
            size: normalizeImageSize("dall-e-3", currentPayload.size as PersonaImageSize),
          };
          modelUsed = "dall-e-3";
          sizeUsed = currentPayload.size as PersonaImageSize;
          allowFallback = false;
          continue;
        }

        throw generationError;
      }
    }

    const b64 = (response as any).data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Image generation returned no data");
    }

    const buffer = Buffer.from(b64, "base64");
  const fileName = sharedPersonaKey ? `${sharedPersonaKey}.png` : `${roleKey}-${Date.now()}.png`;
  const storagePath = sharedPersonaKey ? `shared/${fileName}` : `${caseId}/${fileName}`;
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    const { error: uploadError } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(DEFAULT_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      throw new Error("Failed to resolve public URL for persona portrait");
    }

    const nextMetadata: Record<string, unknown> = {
      ...(personaMetadata ?? {}),
      identity,
      voiceId,
      sex: personaSex,
      generatedAt: new Date().toISOString(),
      model: modelUsed,
      size: sizeUsed,
    };

    await markPersonaStatus(supabase, personaRow, caseId, roleKey, "ready", {
      image_url: publicUrl,
      last_generated_at: new Date().toISOString(),
      display_name: displayName,
      prompt: promptText,
      generated_by: personaRow?.generated_by ?? "system",
      metadata: nextMetadata,
    });

    personaRow = (await fetchPersonaRow(supabase, caseId, roleKey)) ?? personaRow;
    const refreshedMetadata = parsePersonaMetadata(personaRow);
    const refreshedVoiceId = (refreshedMetadata?.voiceId ??
      refreshedMetadata?.identity?.voiceId ?? voiceId) as string | undefined;
    const refreshedSex = (refreshedMetadata?.sex ??
      refreshedMetadata?.identity?.sex ?? personaSex) as PersonaSex | undefined;
    const refreshedDisplayName = personaRow?.display_name ?? displayName;

    const refreshedIdentity = (refreshedMetadata?.identity ?? identity) as
      | PersonaIdentity
      | undefined;

    return {
      imageUrl: publicUrl,
      roleKey,
      displayName: refreshedDisplayName,
      voiceId: refreshedVoiceId,
      sex: refreshedSex,
      identity: refreshedIdentity,
    };
  } catch (error) {
    console.error("Failed to generate persona portrait", error);
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    const failureMetadata: Record<string, unknown> = {
      ...(personaMetadata ?? {}),
      identity,
      voiceId,
      sex: personaSex,
      error: errorMessage,
      failedAt: new Date().toISOString(),
      model: modelUsed,
      sizeTried: sizeUsed,
    };
    await markPersonaStatus(supabase, personaRow, caseId, roleKey, "failed", {
      prompt: promptText,
      metadata: failureMetadata,
    });
    return {
      roleKey,
      displayName,
      voiceId,
      sex: personaSex,
      identity,
    };
  }
}

async function generateMissingPortraits(
  supabase: SupabaseClient,
  openai: OpenAi,
  caseId: string
) {
  const { data, error } = await supabase
    .from("case_personas")
    .select("role_key, display_name, status, image_url")
    .eq("case_id", caseId);

  if (error) {
    console.warn("Unable to read personas for portrait generation", error);
    return;
  }

  const personas = (data ?? []) as PersonaSummaryRow[];
  for (const persona of personas) {
    if (!persona.role_key) continue;
    if (persona.status === "ready" && persona.image_url) continue;
    try {
      await getOrGeneratePersonaPortrait({
        supabase,
        openai,
        caseId,
        stageRole: persona.role_key,
        displayRole: persona.display_name ?? undefined,
      });
    } catch (portraitErr) {
      console.warn(
        `Deferred portrait generation failed for ${persona.role_key} (${caseId})`,
        portraitErr
      );
    }
  }
}

/**
 * @deprecated Global personas are no longer used. This function is a no-op.
 */
async function generateMissingGlobalPortraitsInternal(
  _supabase: SupabaseClient,
  _openai: OpenAi,
  _options?: GlobalPortraitOptions
) {
  console.warn("[DEPRECATED] generateMissingGlobalPortraitsInternal is no longer used. Personas are case-specific.");
  // No-op - global personas are deprecated
}

/**
 * @deprecated Global personas are no longer used. Use case-specific persona generation instead.
 * This function is now a no-op to prevent breaking existing code.
 */
export async function generateMissingGlobalPortraits(
  _supabase: SupabaseClient,
  _openai: OpenAi,
  _options?: GlobalPortraitOptions
): Promise<void> {
  console.warn("[DEPRECATED] generateMissingGlobalPortraits is no longer used. Personas are case-specific.");
  // No-op - global personas are deprecated
}

/**
 * @deprecated Global personas are no longer used. Use case-specific persona generation instead.
 * This function is now a no-op to prevent breaking existing code.
 */
export function scheduleGlobalPersonaPortraitGeneration(
  _supabase: SupabaseClient,
  _openai: OpenAi,
  _options?: GlobalPortraitOptions
) {
  console.warn("[DEPRECATED] scheduleGlobalPersonaPortraitGeneration is no longer used. Personas are case-specific.");
  // No-op - global personas are deprecated
}

export function scheduleCasePersonaPortraitGeneration(
  supabase: SupabaseClient,
  openai: OpenAi,
  caseId: string
) {
  void generateMissingPortraits(supabase, openai, caseId).catch((error) => {
    console.warn(
      `Background persona portrait generation failed for case ${caseId}`,
      error
    );
  });
}

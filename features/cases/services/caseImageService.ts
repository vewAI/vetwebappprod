import { Buffer } from "buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type OpenAI from "openai";

export type CaseRecord = Record<string, unknown>;

const CASE_IMAGE_BUCKET =
  process.env.CASE_IMAGE_BUCKET ??
  process.env.NEXT_PUBLIC_CASE_IMAGE_BUCKET ??
  "case-images";

const CASE_IMAGE_MODEL =
  process.env.CASE_IMAGE_MODEL ??
  process.env.PERSONA_IMAGE_MODEL ??
  "dall-e-3";

const CASE_IMAGE_PROVIDER =
  (process.env.CASE_IMAGE_PROVIDER ?? "openai").toLowerCase();

const ALLOWED_SIZES = new Set([
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
  "auto",
]);

const DEFAULT_CASE_IMAGE_SIZE =
  ALLOWED_SIZES.has((process.env.CASE_IMAGE_SIZE as string) ?? "")
    ? (process.env.CASE_IMAGE_SIZE as string)
    : "1024x1024";

type GenerateOptions = {
  force?: boolean;
  provider?: "gemini" | "openai";
};

function pluckString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: string[]): string {
  for (const value of values) {
    if (value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

const MAX_PROMPT_LENGTH = 800;

function truncatePrompt(value: string): string {
  if (value.length <= MAX_PROMPT_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_PROMPT_LENGTH - 3)}...`;
}

const SPECIES_ENVIRONMENT: Record<string, string> = {
  equine: "in a clean stable or pasture setting",
  bovine: "on a farm with natural rural lighting",
  canine: "in a modern veterinary clinic exam room",
  feline: "in a quiet veterinary examination room",
  ovine: "in an open field or farm pen",
  caprine: "in a farmyard or pastoral setting",
  porcine: "in a clean farm environment",
  camelid: "in an open pastoral or farm setting",
  avian: "in a clinical avian examination setting",
};

function buildPromptFromCase(caseData: CaseRecord): string {
  const title = pluckString(caseData["title"]);
  const condition = pluckString(caseData["condition"]);
  const species = pluckString(caseData["species"]).toLowerCase();
  const description = pluckString(caseData["description"]);

  const details = (() => {
    const raw = caseData["details"];
    if (typeof raw === "string") {
      return raw;
    }
    if (raw && typeof raw === "object") {
      try {
        return JSON.stringify(raw, null, 2);
      } catch {
        return "";
      }
    }
    return "";
  })();

  const patientName = pluckString(caseData["patient_name"]);
  const subject = patientName
    ? `${patientName} the ${species || "animal"}`
    : species
      ? `a ${species} patient`
      : "an animal patient";

  const env = SPECIES_ENVIRONMENT[species] ?? "in a professional veterinary setting";

  const conditionClause = condition
    ? `presenting with clinical signs consistent with ${condition.toLowerCase()}`
    : "showing the primary clinical concern";

  const descriptiveBits = [description, details]
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .join(" ");

  const prompt = [
    "Professional veterinary clinical photograph",
    `of ${subject} ${env}`,
    conditionClause,
    descriptiveBits ? `Clinical context: ${descriptiveBits.slice(0, 300)}` : "",
    "Realistic medical documentation style, natural clinical lighting, detailed and accurate anatomy, no text overlays or diagrams",
  ]
    .filter(Boolean)
    .join(". ");

  return truncatePrompt(prompt);
}

function buildSafetyFallbackPrompt(caseData: CaseRecord): string {
  const title = pluckString(caseData["title"]);
  const species = pluckString(caseData["species"]).toLowerCase();
  const condition = pluckString(caseData["condition"]);

  const baseAnimal = firstNonEmpty(title, species).toLowerCase();
  const subject = baseAnimal
    ? `a ${baseAnimal}`
    : "an animal patient in a veterinary setting";

  const env = SPECIES_ENVIRONMENT[species] ?? "in a professional veterinary setting";

  const prompt = [
    "Gentle veterinary photograph",
    `of ${subject} ${env}`,
    condition ? `resting comfortably, focus on overall wellbeing during ${condition.toLowerCase()}` : "",
    "Natural lighting, compassionate clinical tone, high detail",
  ]
    .filter(Boolean)
    .join(". ");

  return truncatePrompt(prompt);
}

// ── Gemini Imagen via REST ──

async function generateWithGemini(
  prompt: string,
): Promise<Buffer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        personGeneration: "dont_allow",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Imagen responded ${res.status}: ${text}`);
  }

  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    throw new Error("Gemini Imagen returned no image data");
  }

  return Buffer.from(b64, "base64");
}

// ── OpenAI DALL-E ──

async function generateWithOpenAI(
  openai: OpenAI,
  prompt: string,
): Promise<Buffer | null> {
  const response = await openai.images.generate({
    model: CASE_IMAGE_MODEL,
    prompt,
    n: 1,
    size: DEFAULT_CASE_IMAGE_SIZE as Parameters<
      OpenAI["images"]["generate"]
    >[0]["size"],
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("DALL-E returned no image data");
  }

  return Buffer.from(b64, "base64");
}

async function uploadImage(
  supabase: SupabaseClient,
  caseId: string,
  imageBuffer: Buffer
): Promise<string> {
  const fileName = `case-cover-${Date.now()}.png`;
  const storagePath = `${caseId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(CASE_IMAGE_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from(CASE_IMAGE_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    throw new Error("Unable to resolve public URL for generated case image");
  }

  return publicUrl;
}

export async function generateCaseImage(
  supabase: SupabaseClient,
  openai: OpenAI | null,
  caseData: CaseRecord,
  options: GenerateOptions = {}
): Promise<string | null> {
  const caseId = pluckString(caseData["id"]);
  if (!caseId) {
    return null;
  }

  const existingUrl = pluckString(caseData["image_url"]);
  if (existingUrl && !options.force) {
    return existingUrl;
  }

  const primaryPrompt = buildPromptFromCase(caseData);
  if (!primaryPrompt) {
    return existingUrl || null;
  }

  const candidatePrompts = [primaryPrompt];
  const fallbackPrompt = buildSafetyFallbackPrompt(caseData);
  if (fallbackPrompt && !candidatePrompts.includes(fallbackPrompt)) {
    candidatePrompts.push(fallbackPrompt);
  }

  const requestedProvider = options.provider ?? CASE_IMAGE_PROVIDER;
  const providers = requestedProvider === "gemini"
    ? ["gemini", "openai"]
    : ["openai"];

  let imageBuffer: Buffer | null = null;

  for (const provider of providers) {
    for (const prompt of candidatePrompts) {
      try {
        if (provider === "gemini") {
          imageBuffer = await generateWithGemini(prompt);
        } else if (openai) {
          imageBuffer = await generateWithOpenAI(openai, prompt);
        }

        if (imageBuffer) break;
      } catch (error) {
        const message =
          error && typeof error === "object"
            ? "message" in error
              ? String((error as { message?: unknown }).message ?? "")
              : ""
            : "";
        console.warn(`[case-image] ${provider} attempt failed: ${message}`);

        const isSafetyRejection =
          typeof message === "string" &&
          message.toLowerCase().includes("safety") &&
          message.toLowerCase().includes("prompt");

        if (!isSafetyRejection) break;
      }
    }
    if (imageBuffer) break;
  }

  if (!imageBuffer) {
    throw new Error("Case image generation failed across all providers");
  }

  const publicUrl = await uploadImage(supabase, caseId, imageBuffer);

  const { error } = await supabase
    .from("cases")
    .update({ image_url: publicUrl })
    .eq("id", caseId);

  if (error) {
    console.warn("Failed to persist generated case image URL", error);
  }

  return publicUrl;
}

export function scheduleCaseImageGeneration(
  supabase: SupabaseClient,
  openai: OpenAI,
  caseData: CaseRecord,
  options: GenerateOptions = {}
) {
  void (async () => {
    try {
      await generateCaseImage(supabase, openai, caseData, options);
    } catch (error) {
      console.warn(
        `Failed to generate case image for ${pluckString(caseData["id"])}:`,
        error
      );
    }
  })();
}

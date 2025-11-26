import { Buffer } from "node:buffer";
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

function buildPromptFromCase(caseData: CaseRecord): string {
  const title = pluckString(caseData["title"]);
  const condition = pluckString(caseData["condition"]);
  const species = pluckString(caseData["species"]);
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

  const baseAnimal = firstNonEmpty(title, species, condition).toLowerCase();
  const subject = baseAnimal
    ? `a ${baseAnimal}`
    : "an animal patient relevant to the veterinary case";

  const conditionClause = condition
    ? `showing clinical features consistent with ${condition.toLowerCase()}`
    : "capturing the primary clinical concern";

  const descriptiveBits = [description, details]
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .join(" ");

  const prompt = [
    "Hyper-realistic veterinary photograph",
    `of ${subject}`,
    conditionClause,
    descriptiveBits ? `Context: ${descriptiveBits}` : "",
    "Cinematic lighting, shallow depth of field, professional documentary style, 8k detail, high dynamic range",
  ]
    .filter(Boolean)
    .join(". ");

  return truncatePrompt(prompt);
}

function buildSafetyFallbackPrompt(caseData: CaseRecord): string {
  const title = pluckString(caseData["title"]);
  const species = pluckString(caseData["species"]);
  const condition = pluckString(caseData["condition"]);

  const baseAnimal = firstNonEmpty(title, species).toLowerCase();
  const subject = baseAnimal
    ? `a ${baseAnimal}`
    : "an animal patient relevant to the veterinary scenario";

  const prompt = [
    "Documentary-style veterinary photograph",
    `of ${subject}`,
    condition ? `gentle focus on wellbeing during ${condition.toLowerCase()}` : "",
    "Natural lighting, compassionate tone, high detail",
  ]
    .filter(Boolean)
    .join(". ");

  return truncatePrompt(prompt);
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
  openai: OpenAI,
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

  let lastError: unknown = null;
  let response: Awaited<ReturnType<OpenAI["images"]["generate"]>> | null =
    null;

  for (const prompt of candidatePrompts) {
    try {
      response = await openai.images.generate({
        model: CASE_IMAGE_MODEL,
        prompt,
        n: 1,
        size: DEFAULT_CASE_IMAGE_SIZE as Parameters<
          OpenAI["images"]["generate"]
        >[0]["size"],
        response_format: "b64_json",
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message =
        error && typeof error === "object"
          ? "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : ""
          : "";
      const isSafetyRejection =
        typeof message === "string" &&
        message.toLowerCase().includes("safety") &&
        message.toLowerCase().includes("prompt");

      if (!isSafetyRejection) {
        break;
      }
    }
  }

  if (!response) {
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error("Case image generation failed without a response");
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Case image generation returned no data");
  }

  const buffer = Buffer.from(b64, "base64");
  const publicUrl = await uploadImage(supabase, caseId, buffer);

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

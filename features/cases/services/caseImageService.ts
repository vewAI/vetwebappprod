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
  (process.env.CASE_IMAGE_PROVIDER ?? "gemini").toLowerCase();

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

// ── Gemini / Vertex AI Imagen ──

async function generateWithGemini(
  prompt: string,
): Promise<Buffer | null> {
  let lastError: Error | null = null;

  // 1. Try Vertex AI Imagen via ADC (used in production on Vercel)
  try {
    const { getVertexAccessToken, vertexModelUrl } = await import("@/app/api/_lib/vertex");
    const accessToken = await getVertexAccessToken();
    const vertexModels = [
      "imagen-3.0-generate-002",
      "imagen-3.0-fast-generate-001",
    ];

    for (const model of vertexModels) {
      try {
        const url = vertexModelUrl(model, "predict");
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
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

        if (res.ok) {
          const data = await res.json();
          const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
          if (b64) {
            return Buffer.from(b64, "base64");
          }
        } else {
          const text = await res.text().catch(() => "");
          console.warn(`[case-image] Vertex AI ${model} responded ${res.status}: ${text.slice(0, 300)}`);
          lastError = new Error(`Vertex AI ${model} responded ${res.status}: ${text.slice(0, 300)}`);
        }
      } catch (err: any) {
        console.warn(`[case-image] Vertex AI ${model} request error: ${err?.message}`);
        lastError = err;
      }
    }
  } catch (vertexInitErr: any) {
    console.warn(`[case-image] Vertex ADC setup: ${vertexInitErr?.message}`);
  }

  // 2. Try Google AI Studio (using GEMINI_API_KEY or AIza key in OPENAI_API_KEY)
  const apiKey =
    process.env.GEMINI_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith("AIza") ? process.env.OPENAI_API_KEY : undefined);

  if (apiKey) {
    // 2a. Try Gemini content generation with IMAGE modality
    const contentModels = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image",
      "gemini-3-pro-image",
    ];

    for (const model of contentModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              return Buffer.from(part.inlineData.data, "base64");
            }
          }
        } else {
          const text = await res.text().catch(() => "");
          console.warn(`[case-image] AI Studio ${model} responded ${res.status}: ${text.slice(0, 300)}`);
          lastError = new Error(`AI Studio ${model} responded ${res.status}: ${text.slice(0, 300)}`);
        }
      } catch (err: any) {
        console.warn(`[case-image] AI Studio ${model} request error: ${err?.message}`);
        lastError = err;
      }
    }

    // 2b. Try AI Studio Imagen predict endpoint if available
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
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

      if (res.ok) {
        const data = await res.json();
        const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          return Buffer.from(b64, "base64");
        }
      }
    } catch {
      // Ignore
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

// ── OpenAI DALL-E ──

async function generateWithOpenAI(
  openai: OpenAI,
  prompt: string,
): Promise<Buffer | null> {
  const models = [CASE_IMAGE_MODEL, "dall-e-3", "dall-e-2"];
  const uniqueModels = Array.from(new Set(models.filter(Boolean)));

  let lastErr: Error | null = null;
  for (const model of uniqueModels) {
    try {
      const response = await openai.images.generate({
        model,
        prompt,
        n: 1,
        size: (model === "dall-e-2" ? "512x512" : DEFAULT_CASE_IMAGE_SIZE) as Parameters<
          OpenAI["images"]["generate"]
        >[0]["size"],
        response_format: "b64_json",
      });

      const b64 = response.data?.[0]?.b64_json;
      if (b64) {
        return Buffer.from(b64, "base64");
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[case-image] OpenAI ${model} failed:`, err?.message);
    }
  }

  if (lastErr) throw lastErr;
  return null;
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
  const providers = requestedProvider === "openai"
    ? ["openai", "gemini"]
    : ["gemini", "openai"];

  let imageBuffer: Buffer | null = null;
  let lastErrorMessage = "";

  for (const provider of providers) {
    for (const prompt of candidatePrompts) {
      try {
        if (provider === "gemini") {
          imageBuffer = await generateWithGemini(prompt);
        } else {
          let client = openai;
          if (!client) {
            try {
              const { createOpenAIClient } = await import("@/lib/llm/openaiClient");
              client = await createOpenAIClient();
            } catch {
              // OpenAI client unavailable
            }
          }
          if (client) {
            imageBuffer = await generateWithOpenAI(client, prompt);
          }
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
        lastErrorMessage = `${provider}: ${message}`;

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
    throw new Error(
      `Case image generation failed across all providers (${providers.join(", ")}). Last error: ${lastErrorMessage || "No image data returned"}`
    );
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
  openai: OpenAI | null,
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

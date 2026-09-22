// Shared Gemini text-generation helper, now on Google Cloud Vertex AI.
// Auth is entirely ADC (see app/api/_lib/vertex.ts) — no API keys anywhere.
// Fails fast with a hard timeout and falls back across model availability
// automatically. Model cascade: Vertex projects expose stable Gemini IDs
// (the AI Studio "gemini-flash-latest" alias does not exist on Vertex), and
// 2.5 is a "thinking" model that needs thinkingBudget: 0 to avoid burning the
// whole output budget on reasoning and returning EMPTY text.

import { getVertexAISdk } from "./vertex";

const MODELS: { model: string; body: Record<string, unknown> }[] = [
  {
    model: "gemini-2.5-flash",
    body: { thinkingConfig: { thinkingBudget: 0 } },
  },
  { model: "gemini-2.0-flash", body: {} },
  { model: "gemini-2.0-flash-lite", body: {} },
];

// AI Studio fallback used when Vertex ADC is unavailable or rejects the
// request (e.g. serverless deploys without GOOGLE_SERVICE_ACCOUNT_JSON).
// Same key the Gemini Live voice sessions already use.
const AI_STUDIO_MODELS: { model: string; body: Record<string, unknown> }[] = [
  { model: "gemini-flash-latest", body: {} },
  { model: "gemini-2.0-flash", body: {} },
  {
    model: "gemini-2.5-flash",
    body: { thinkingConfig: { thinkingBudget: 0 } },
  },
];

async function generateWithAiStudio(opts: {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const { prompt, temperature, maxOutputTokens, timeoutMs } = opts;

  let lastError: Error | null = null;
  for (const candidate of AI_STUDIO_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature,
                maxOutputTokens,
                ...candidate.body,
              },
            }),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          lastError = new Error(`Gemini ${candidate.model} failed: ${res.status} ${detail.slice(0, 300)}`);
          if (res.status === 429 || res.status >= 500) continue;
          break;
        }
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        if (!text) {
          lastError = new Error(`Gemini ${candidate.model} returned an empty response`);
          break; // next model
        }
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt > 0) break;
      }
    }
  }
  throw lastError ?? new Error("Gemini generation failed");
}

export async function generateGeminiText(opts: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const {
    prompt,
    temperature = 0.4,
    maxOutputTokens = 2000,
    timeoutMs = 90_000,
  } = opts;

  const ai = await getVertexAISdk();
  let lastError: Error | null = null;

  for (const candidate of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Backoff before retrying the same model on transient errors.
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
        const generationConfig = {
          temperature,
          maxOutputTokens,
          ...candidate.body,
          // Vertex accepts thinkingConfig inside generationConfig; the SDK's
          // typings lag the surface, hence the loose cast below.
        } as never;
        const generativeModel = ai.getGenerativeModel({
          model: candidate.model,
          generationConfig,
        });
        const result = await Promise.race([
          generativeModel.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini ${candidate.model} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
        const text = (result as { response?: { text?: () => string } }).response?.text?.() ?? "";
        const trimmed = text.trim();
        if (!trimmed) {
          lastError = new Error(`Gemini ${candidate.model} returned an empty response`);
          break; // next model
        }
        return trimmed;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const message = lastError.message;
        const transient = /\b(429|500|502|503|504)\b|timed out|ECONNRESET|aborted/i.test(message);
        if (!transient || attempt > 0) break; // move to next model
      }
    }
  }

  // Vertex failed entirely (commonly GoogleAuthError when ADC / the service
  // account is not configured on the host). Fall back to the AI Studio key
  // so feedback/findings keep working instead of surfacing an auth error.
  if (process.env.GEMINI_API_KEY) {
    return generateWithAiStudio({ prompt, temperature, maxOutputTokens, timeoutMs });
  }
  throw lastError ?? new Error("Gemini generation failed");
}

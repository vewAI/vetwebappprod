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
  throw lastError ?? new Error("Gemini generation failed");
}

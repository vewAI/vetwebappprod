// Shared Gemini text-generation helper (v1beta REST API).
// Uses the same GEMINI_API_KEY as the voice sessions. Fails fast with a hard
// timeout and falls back across model availability automatically.

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

export async function generateGeminiText(opts: {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const {
    prompt,
    temperature = 0.4,
    maxOutputTokens = 2000,
    timeoutMs = 90_000,
  } = opts;

  let lastError: Error | null = null;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        lastError = new Error(`Gemini ${model} failed: ${res.status} ${detail.slice(0, 300)}`);
        continue; // try the next model
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (!text) {
        lastError = new Error(`Gemini ${model} returned an empty response`);
        continue;
      }
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error("Gemini generation failed");
}

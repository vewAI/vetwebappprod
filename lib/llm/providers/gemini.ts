// Minimal Gemini embeddings wrapper. This attempts to call Google's
// Generative Embeddings endpoint when `GEMINI_API_KEY` is present.
// NOTE: Endpoint and model names may vary; adjust for your Google Cloud setup.

export async function createEmbeddingsGemini(inputs: string[], model?: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err: any = new Error("Gemini API key not configured");
    err.status = 403;
    throw err;
  }
  const usedModel = model || process.env.GEMINI_EMBEDDING_MODEL || "textembedding-gecko-001";
  const url = `https://generativelanguage.googleapis.com/v1beta2/models/${usedModel}:embed`;

  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: inputs }),
      });

      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`Gemini responded ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const out = (data?.embeddings || []).map((e: any) => ({ embedding: e?.embedding ?? e, model: usedModel }));
      return out;
    } catch (err: any) {
      console.warn(`Gemini embeddings attempt ${attempt} failed:`, err?.message ?? err);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
}

export default { createEmbeddingsGemini };

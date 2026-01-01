// Minimal AI Studio adapter scaffold.
// Implement actual endpoints and authentication according to AI Studio docs.

export async function createEmbeddingsAIStudio(inputs: string[], model?: string) {
  const key = process.env.AISTUDIO_API_KEY;
  if (!key) {
    const err: any = new Error("AI Studio API key not configured");
    err.status = 403;
    throw err;
  }
  const usedModel = model || process.env.AISTUDIO_EMBEDDING_MODEL || "aistudio-embed-1";
  const url = process.env.AISTUDIO_EMBEDDING_URL || "https://aistudio.example.com/v1/embeddings";

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
        body: JSON.stringify({ model: usedModel, input: inputs }),
      });
      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`AI Studio responded ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      return (data?.data || []).map((d: any) => ({ embedding: d.embedding, model: usedModel }));
    } catch (err: any) {
      console.warn(`AI Studio embeddings attempt ${attempt} failed:`, err?.message ?? err);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
}

export default { createEmbeddingsAIStudio };

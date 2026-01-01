import fetch from "node-fetch";

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
    // Normalize structure
    return (data?.data || []).map((d: any) => ({ embedding: d.embedding, model: usedModel }));
  } catch (err) {
    throw err;
  }
}

export default { createEmbeddingsAIStudio };

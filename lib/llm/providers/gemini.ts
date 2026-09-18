// Vertex AI embeddings wrapper (ADC-authenticated REST).
// Replaces the retired AI Studio v1beta2 embed endpoint. Uses the Vertex
// publisher model text-embedding-005 via
// projects/{p}/locations/{l}/publishers/google/models/{model}:predict.

import { getVertexAccessToken, vertexModelUrl } from "@/app/api/_lib/vertex";

export async function createEmbeddingsGemini(inputs: string[], model?: string) {
  const usedModel = model || process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-005";
  const url = vertexModelUrl(usedModel, "predict");
  const accessToken = await getVertexAccessToken();

  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: inputs.map((input) => ({ content: input })),
          parameters: { taskType: "RETRIEVAL_DOCUMENT" },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`Vertex embeddings responded ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const predictions = (data?.predictions ?? []) as Array<{
        embeddings?: { values?: number[] };
      }>;
      const out = predictions.map((p, i) => ({
        embedding: p?.embeddings?.values ?? [],
        model: usedModel,
        index: i,
      }));
      return out;
    } catch (err: any) {
      console.warn(`Vertex embeddings attempt ${attempt} failed:`, err?.message ?? err);
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }
}

export default { createEmbeddingsGemini };

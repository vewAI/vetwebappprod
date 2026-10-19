import OpenAI from "openai";

let client: OpenAI | null = null;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function createEmbeddingsOpenAI(inputs: string[], model?: string) {
  const openai = getClient();
  const used = model || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const resp = await openai.embeddings.create({ model: used, input: inputs });
      return resp.data.map((d: any) => ({ embedding: d.embedding, model: used }));
    } catch (err: any) {
      console.warn(`OpenAI embeddings attempt ${attempt} failed:`, err?.message ?? err);
      if (attempt >= maxAttempts) throw err;
      const backoff = 100 * Math.pow(2, attempt);
      await delay(backoff);
    }
  }
}

export default {
  createEmbeddingsOpenAI,
};

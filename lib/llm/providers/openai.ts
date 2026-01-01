import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || undefined });

export async function createEmbeddingsOpenAI(inputs: string[], model?: string) {
  const used = model || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const resp = await client.embeddings.create({ model: used, input: inputs });
  // Map to array of vectors
  return resp.data.map((d: any) => ({ embedding: d.embedding, model: used }));
}

export default {
  createEmbeddingsOpenAI,
};

import * as fs from "fs";
import path from "path";
import * as openaiProv from "./providers/openai";
import * as geminiProv from "./providers/gemini";

export type LlmProviderName = "openai" | "gemini";

async function loadConfig() {
  // Local JSON config for quick pilots (optional)
  try {
    const cfgPath = path.join(process.cwd(), "tmp", "llm-provider-config.json");
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      return JSON.parse(raw) as any;
    }
  } catch (e) {
    // ignore
  }
  // Fallback to env variables
  return {
    defaultProvider: (process.env.LLM_DEFAULT_PROVIDER || "openai") as LlmProviderName,
    featureOverrides: {
      embeddings: process.env.LLM_PROVIDER_EMBEDDINGS || null,
    },
  };
}

export async function resolveProviderForFeature(feature: string) {
  const cfg = await loadConfig();
  const override = cfg?.featureOverrides?.[feature];
  if (override) return override as LlmProviderName;
  return (cfg?.defaultProvider || "openai") as LlmProviderName;
}

export async function embeddings(inputs: string[], opts?: { provider?: LlmProviderName; model?: string }) {
  const provider = opts?.provider ?? (await resolveProviderForFeature("embeddings"));
  if (provider === "gemini") {
    return await geminiProv.createEmbeddingsGemini(inputs, opts?.model);
  }
  return await openaiProv.createEmbeddingsOpenAI(inputs, opts?.model);
}

export default { embeddings, resolveProviderForFeature };

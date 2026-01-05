import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import * as openaiProv from "./providers/openai";
import * as geminiProv from "./providers/gemini";
import * as aistudioProv from "./providers/aistudio";

export type LlmProviderName = "openai" | "gemini" | "aistudio";

const SETTINGS_KEY = "llm_provider_config";

async function loadConfigFromDb() {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error) {
      console.warn("Failed to read llm_provider_config from DB", error);
      return null;
    }
    return data?.value ?? null;
  } catch (err) {
    console.warn("Exception reading llm_provider_config from DB", err);
    return null;
  }
}

async function loadConfig() {
  const dbCfg = await loadConfigFromDb();
  if (dbCfg) return dbCfg;

  // Fallback to env variables if DB not available
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
  if (provider === "aistudio") {
    return await aistudioProv.createEmbeddingsAIStudio(inputs, opts?.model);
  }
  return await openaiProv.createEmbeddingsOpenAI(inputs, opts?.model);
}

export default { embeddings, resolveProviderForFeature };

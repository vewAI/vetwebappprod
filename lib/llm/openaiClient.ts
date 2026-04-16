import { readFileSync } from "fs";
import { join } from "path";

/**
 * Read a specific env variable from .env.local file directly
 * This bypasses Node.js env var conflicts in PowerShell
 */
function readEnvFromFile(key: string): string | undefined {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith(key + "=")) {
        return line.substring(key.length + 1).trim();
      }
    }
  } catch (err) {
    // File not found or other error, fall back to process.env
  }
  return undefined;
}

export async function createOpenAIClient() {
  // Try to read directly from .env.local file first, then fall back to process.env
  let candidateKey = readEnvFromFile("OPENAI_API_KEY") || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";

  // Debug: log what environment variables are set
  console.log("[OpenAI Factory] OPENAI_API_KEY defined:", !!process.env.OPENAI_API_KEY);
  console.log("[OpenAI Factory] OPENAI_KEY defined:", !!process.env.OPENAI_KEY);
  console.log("[OpenAI Factory] Candidate key starts with:", candidateKey.substring(0, 10));

  if (!candidateKey) {
    throw new Error("OPENAI_API_KEY not configured on the server");
  }

  // Guard against accidentally using a Google API key (starts with 'AIza')
  if (candidateKey.startsWith("AIza")) {
    console.error("[OpenAI Factory] ERROR: candidateKey starts with 'AIza' — it's a Google key!");
    throw new Error("OPENAI_API_KEY appears to be a Google API key (starts with 'AIza'). Please set a valid OpenAI key in OPENAI_API_KEY.");
  }

  // Dynamically import the OpenAI client to avoid static import issues in tests
  const OpenAIImport = await import("openai");
  const OpenAI = (OpenAIImport as any).default ?? OpenAIImport;
  return new OpenAI({ apiKey: candidateKey });
}

export default { createOpenAIClient };

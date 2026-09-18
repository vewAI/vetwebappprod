// Shared Vertex AI access (server-side only).
//
// Migration from Google AI Studio (GEMINI_API_KEY) to Google Cloud Vertex AI:
// - Authentication relies ENTIRELY on Application Default Credentials (ADC).
//   Nothing is passed into client constructors — no API keys, no key files.
//   Locally, ADC comes from `gcloud auth application-default login`.
//   On Vercel (which has no gcloud ADC), set GOOGLE_SERVICE_ACCOUNT_JSON to a
//   base64 (or raw) service-account JSON secret; it is materialized to /tmp at
//   runtime and exported as GOOGLE_APPLICATION_CREDENTIALS, which the ADC
//   toolchain picks up automatically.
// - Project/location default to the app's Google Cloud project and can be
//   overridden with GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION.
// - Gemini Live voice sessions intentionally stay on AI Studio ephemeral
//   tokens (browsers cannot use ADC; Vertex has no browser token equivalent).

import { GoogleAuth } from "google-auth-library";

export const VERTEX_PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ?? "gen-lang-client-0598890915";
export const VERTEX_LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

let adcReady = false;

/**
 * Materialize the Vercel service-account secret (if any) into GOOGLE_APPLICATION_CREDENTIALS
 * so google-auth-library's ADC resolves in serverless. Idempotent; a no-op when
 * the secret is absent or ADC is already configured (local `gcloud` login).
 */
export function ensureVertexAdc(): void {
  if (adcReady) return;
  adcReady = true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return;
  try {
    const { writeFileSync, mkdirSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const { tmpdir } = require("os") as typeof import("os");
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    JSON.parse(json); // fail fast on malformed secrets
    const dir = join(tmpdir(), "gcp-adc");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "sa.json");
    writeFileSync(file, json, { encoding: "utf8", mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
  } catch (err) {
    console.error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is set but invalid — ADC will use ambient credentials only:",
      err instanceof Error ? err.message : err
    );
  }
}

let authClient: GoogleAuth | null = null;

/** Shared ADC resolver. Never receives a key — purely environment-based. */
export function getVertexAuth(): GoogleAuth {
  ensureVertexAdc();
  if (!authClient) {
    authClient = new GoogleAuth({
      projectId: VERTEX_PROJECT,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return authClient;
}

let sdkClient: unknown = null;

/** Lazy @google-cloud/vertexai client (ADC-based, keyless constructor). */
export async function getVertexAISdk() {
  ensureVertexAdc();
  if (!sdkClient) {
    const { VertexAI } = await import("@google-cloud/vertexai");
    sdkClient = new VertexAI({ project: VERTEX_PROJECT, location: VERTEX_LOCATION });
  }
  return sdkClient as import("@google-cloud/vertexai").VertexAI;
}

/** ADC bearer token for direct Vertex REST calls (Imagen, embeddings, TTS). */
export async function getVertexAccessToken(): Promise<string> {
  const client = await getVertexAuth().getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to resolve ADC access token for Vertex AI");
  return token;
}

/** REST base for publisher models on this project/location. */
export function vertexModelUrl(model: string, method: string): string {
  return `https://aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:${method}`;
}

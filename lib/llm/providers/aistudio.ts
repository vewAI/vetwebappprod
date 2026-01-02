// AI Studio adapter with support for Google-style OAuth service account authentication.
// It supports two auth modes:
//  - Service account credentials via `AISTUDIO_SERVICE_ACCOUNT` (JSON string or base64)
//  - API key via `AISTUDIO_API_KEY` (appended as ?key=... when appropriate)

import { GoogleAuth } from "google-auth-library";

async function obtainAccessTokenFromServiceAccount(): Promise<string> {
  const raw = process.env.AISTUDIO_SERVICE_ACCOUNT;
  if (!raw) throw new Error("AISTUDIO_SERVICE_ACCOUNT not provided");
  let creds: any = null;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    // maybe base64 encoded
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      creds = JSON.parse(decoded);
    } catch (e2) {
      throw new Error("AISTUDIO_SERVICE_ACCOUNT is not valid JSON nor base64-encoded JSON");
    }
  }

  const auth = new GoogleAuth({ credentials: creds });
  const client = await auth.getClient();
  const at: any = await client.getAccessToken();
  const token = typeof at === "string" ? at : at?.token;
  if (!token) throw new Error("Failed to obtain access token from service account");
  return token;
}

export async function createEmbeddingsAIStudio(inputs: string[], model?: string) {
  const apiKey = process.env.AISTUDIO_API_KEY;
  const usedModel = model || process.env.AISTUDIO_EMBEDDING_MODEL || "aistudio-embed-1";
  const url = process.env.AISTUDIO_EMBEDDING_URL || "https://aistudio.example.com/v1/embeddings";

  // Fail fast if the project still uses the placeholder URL so logs are clearer
  if (!url || url.includes("example.com") || url.includes("aistudio.example.com")) {
    const err: any = new Error("AI Studio embedding URL not configured. Set AISTUDIO_EMBEDDING_URL to your provider endpoint.");
    err.status = 500;
    throw err;
  }

  const maxAttempts = 3;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      // Choose auth method: prefer service account token if provided
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.AISTUDIO_SERVICE_ACCOUNT) {
        const token = await obtainAccessTokenFromServiceAccount();
        headers["Authorization"] = `Bearer ${token}`;
      } else if (apiKey) {
        // Some Google endpoints accept API key as query param
      } else {
        const err: any = new Error("AI Studio authentication not configured. Provide AISTUDIO_SERVICE_ACCOUNT or AISTUDIO_API_KEY.");
        err.status = 403;
        throw err;
      }

      let targetUrl = url;
      if (apiKey && !process.env.AISTUDIO_SERVICE_ACCOUNT) {
        const sep = targetUrl.includes("?") ? "&" : "?";
        targetUrl = `${targetUrl}${sep}key=${encodeURIComponent(apiKey)}`;
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
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

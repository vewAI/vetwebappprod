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

  // Request an access token scoped for Google Cloud (Vertex AI) operations.
  // The cloud-platform scope is required for most Vertex/Generative AI endpoints.
  const auth = new GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const at: any = await client.getAccessToken();
  const token = typeof at === "string" ? at : at?.token;
  if (!token) throw new Error("Failed to obtain access token from service account");
  return token;
}

async function obtainIdTokenFromServiceAccount(audience: string): Promise<string> {
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
  // getIdTokenClient will return a client that provides ID tokens for the given audience
  const client = await auth.getIdTokenClient(audience);
  const headers = await client.getRequestHeaders();
  const authHeader = headers?.Authorization ?? headers?.authorization;
  if (!authHeader) throw new Error("Failed to obtain ID token from service account");
  // authHeader is like 'Bearer <token>'
  return authHeader.replace(/^Bearer\s+/i, "");
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
      // Choose auth method: prefer service account ID token if provided (audience),
      // otherwise fall back to access token or API key.
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.AISTUDIO_SERVICE_ACCOUNT) {
        // Derive an audience for ID tokens. Allow override via env.
        const audience = process.env.AISTUDIO_ID_TOKEN_AUDIENCE || (url.includes("generativelanguage.googleapis.com") ? "https://generativelanguage.googleapis.com/" : new URL(url).origin);
        try {
          const idToken = await obtainIdTokenFromServiceAccount(audience);
          headers["Authorization"] = `Bearer ${idToken}`;
        } catch (idErr) {
          // fallback to access token
          const token = await obtainAccessTokenFromServiceAccount();
          headers["Authorization"] = `Bearer ${token}`;
        }
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

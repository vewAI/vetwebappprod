import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

// ----------------------------------------------------------------------------
// Defense-in-depth around the Gemini Live token endpoint.
// P0.1 partial fix — see docs/live-chat-improvement-plan.md for the full WS
// proxy plan slated for FASE 4. Today this route still returns the raw api
// key so the @google/genai SDK in the browser can open a WSS connection to
// Google. We mitigate the surface via:
//   1. Authentication (requireUser)
//   2. Origin allowlist (LIVE_ALLOWED_ORIGINS / NEXT_PUBLIC_APP_URL /
//      VERCEL_URL). Strict-deny in production when no allowlist is set.
//   3. Per-user rate limit (3 issues / 60 s)
//   4. Case-existence validation (404 on phantom UUIDs)
// ----------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ISSUES = 3;
const tokenIssuances = new Map<string, number[]>();

function getAllowedOrigins(): string[] {
  const env = process.env.LIVE_ALLOWED_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return [process.env.NEXT_PUBLIC_APP_URL];
  }
  if (process.env.VERCEL_URL) {
    return [`https://${process.env.VERCEL_URL}`];
  }
  if (process.env.NODE_ENV !== "production") {
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  }
  return [];
}

// Loud-fail at module load (Node runtime): if a production deploy has no
// allowlist env, log once. Without this, every Live request silently 403s.
if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  getAllowedOrigins().length === 0
) {
  // eslint-disable-next-line no-console
  console.error(
    "[api/live/token] Misconfiguration: no LIVE_ALLOWED_ORIGINS, NEXT_PUBLIC_APP_URL or VERCEL_URL set. All Live token requests will be rejected with 403.",
  );
}

function isOriginAllowed(req: Request): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    // Strict-deny in production when no allowlist is configured.
    return false;
  }
  const origin =
    req.headers.get("origin") ??
    req.headers.get("referer")?.match(/^https?:\/\/[^/]+/)?.[0];
  if (!origin) return false;
  return allowed.some((a) => origin === a || origin.startsWith(a + "/"));
}

function checkAndUpdateRate(userId: string): boolean {
  const now = Date.now();
  const window = tokenIssuances.get(userId) ?? [];
  const fresh = window.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX_ISSUES) {
    tokenIssuances.set(userId, fresh);
    return false;
  }
  fresh.push(now);
  tokenIssuances.set(userId, fresh);
  return true;
}

// In-memory rate limit. NOTE: this is per-process state only. On Vercel
// serverless every cold-start resets it and concurrent instances do not
// share state, so it is best-effort and not authoritative. For enforcement
// across instances back this with Redis (already in package.json deps) or a
// Supabase RPC counter — flagged for FASE 4 of the Live plan.

// Periodic cleanup so the in-memory map doesn't grow unbounded in long-lived
// server processes. unref() lets the Node process exit when this is the only
// timer holding it open.
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
if (typeof setInterval !== "undefined" && cleanupInterval === null) {
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of tokenIssuances.entries()) {
      const fresh = timestamps.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS
      );
      if (fresh.length === 0) tokenIssuances.delete(userId);
      else tokenIssuances.set(userId, fresh);
    }
  }, 5 * 60_000);
  cleanupInterval.unref?.();
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, user } = auth;

  if (!isOriginAllowed(req)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }

  if (!checkAndUpdateRate(user.id)) {
    return NextResponse.json(
      { error: "Too many token requests. Please retry shortly." },
      { status: 429 }
    );
  }

  // Never send the provider credential to the browser. The current client
  // connects directly to Gemini, so Live remains disabled until a server-side
  // proxy or provider-supported short-lived token is available.
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Live service is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const caseId = body?.caseId;

    if (!caseId) {
      return NextResponse.json(
        { error: "caseId is required" },
        { status: 400 }
      );
    }

    // Validate the requested case exists. Soft-fails on transient DB
    // errors so a Supabase hiccup doesn't block legitimate traffic.
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("id")
        .eq("id", caseId)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: "Case not found or not accessible" },
          { status: 404 }
        );
      }
    } catch (e) {
      console.warn("Case existence check failed (transient):", e);
    }

    return NextResponse.json(
      { error: "Live service is temporarily unavailable" },
      { status: 503 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

// ----------------------------------------------------------------------------
// Gemini Live token endpoint.
//
// Issues a short-lived EPHEMERAL auth token (v1alpha `authTokens.create`) so
// the raw GEMINI_API_KEY is never exposed to the browser (P0.1 in
// docs/live-chat-improvement-plan.md / F3.1 in docs/improvement-plan-live.md).
//
// Token properties:
//   - expires ~3h after issuance (sessions may outlive a class period)
//   - new sessions can only be STARTED within ~15 min of issuance; reconnect
//     attempts always re-request a fresh token from this route
//   - usable for up to 10 new sessions (initial connect + reconnects +
//     persona voice changes)
//
// Mitigations around issuance:
//   1. Authentication (requireUser)
//   2. Origin allowlist (LIVE_ALLOWED_ORIGINS / NEXT_PUBLIC_APP_URL /
//      VERCEL_URL). Strict-deny in production when no allowlist is set.
//   3. Shared per-user rate limit (Redis-backed, 5 issues / 60 s)
//   4. Case-existence validation — fail-closed on DB errors.
//
// Rollback hatch: if ephemeral token issuance fails (e.g. API change), the
// route falls back to the legacy raw key ONLY when
// LIVE_REQUIRE_EPHEMERAL_TOKENS is not "1". Set that env var in production to
// hard-fail instead of leaking the permanent key.
// ----------------------------------------------------------------------------

const EPHEMERAL_TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // 3h
const EPHEMERAL_NEW_SESSION_WINDOW_MS = 15 * 60 * 1000; // 15 min
const EPHEMERAL_TOKEN_MAX_USES = 10;

function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const env = process.env.LIVE_ALLOWED_ORIGINS;
  if (env) env.split(",").map((s) => s.trim()).filter(Boolean).forEach((o) => origins.add(o));
  if (process.env.NEXT_PUBLIC_APP_URL) origins.add(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  // Stable Vercel domains: the production alias and the git-branch URL differ
  // from the per-deployment VERCEL_URL, so users hitting the stable link were
  // rejected with "Origin not allowed".
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return [...origins];
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function isOriginAllowed(req: Request): boolean {
  const origin =
    req.headers.get("origin") ??
    req.headers.get("referer")?.match(/^https?:\/\/[^/]+/)?.[0];
  if (!origin) return false;

  const originHost = hostOf(origin);
  if (!originHost) return false;

  // Same-origin: the browser's Origin is the very host serving this request.
  // This makes the endpoint work on ANY deployment URL or custom domain
  // without extra configuration.
  const requestHost = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  ).toLowerCase();
  if (requestHost && originHost === requestHost) {
    return true;
  }

  const allowed = getAllowedOrigins();
  return allowed.some((a) => {
    if (origin === a || origin.startsWith(a + "/")) return true;
    const allowedHost = hostOf(a);
    return Boolean(allowedHost && allowedHost === originHost);
  });
}

// Loud-fail at module load (Node runtime): if a production deploy has no
// allowlist env, log once. Without this, every Live request silently 403s.
if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  getAllowedOrigins().length === 0
) {
  console.error(
    "[api/live/token] Misconfiguration: no LIVE_ALLOWED_ORIGINS, NEXT_PUBLIC_APP_URL or VERCEL_URL set. All Live token requests will be rejected with 403.",
  );
}

async function createEphemeralToken(): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY as string,
    httpOptions: { apiVersion: "v1alpha" },
  });
  // Fail fast: a hanging Google API call must never stall the request past
  // the function timeout — race it with a hard 6s limit.
  const authToken = await Promise.race([
    ai.authTokens.create({
      config: {
        uses: EPHEMERAL_TOKEN_MAX_USES,
        expireTime: new Date(Date.now() + EPHEMERAL_TOKEN_TTL_MS).toISOString(),
        newSessionExpireTime: new Date(
          Date.now() + EPHEMERAL_NEW_SESSION_WINDOW_MS
        ).toISOString(),
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("ephemeral token request timeout")), 6_000)
    ),
  ]);
  if (!authToken.name) {
    throw new Error("Ephemeral token response missing name");
  }
  return authToken.name;
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

  if (!(await consumeRateLimit(`live-token:${user.id}`, 5, 60_000))) {
    return NextResponse.json(
      { error: "Too many token requests. Please retry shortly." },
      { status: 429 }
    );
  }

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

    // Validate the requested case exists. Fail-closed: a transient DB error
    // must not grant a Live session for an unknown case.
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
      console.error("[api/live/token] Case existence check failed:", e);
      return NextResponse.json(
        { error: "Could not validate case. Please retry." },
        { status: 503 }
      );
    }

    // P0.1 / F3.1: issue an ephemeral token instead of the raw API key.
    try {
      const token = await createEphemeralToken();
      return NextResponse.json({ token });
    } catch (ephemeralErr) {
      console.error(
        "[api/live/token] Ephemeral token issuance failed:",
        ephemeralErr
      );
      if (process.env.LIVE_REQUIRE_EPHEMERAL_TOKENS === "1") {
        return NextResponse.json(
          { error: "Live service is temporarily unavailable" },
          { status: 503 }
        );
      }
      console.warn(
        "[api/live/token] FALLBACK: serving raw GEMINI_API_KEY. Set LIVE_REQUIRE_EPHEMERAL_TOKENS=1 to disable this fallback."
      );
      return NextResponse.json({ token: process.env.GEMINI_API_KEY });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

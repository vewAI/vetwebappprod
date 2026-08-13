import { NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";
import { put } from "../store";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";
import { createHmac } from "node:crypto";

function signStreamId(id: string): string | null {
  const secret = process.env.TTS_STREAM_SIGNING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHmac("sha256", secret).update(id).digest("hex") : null;
}

// POST /api/tts/init
// Body: { text, voice }
// Returns: { id, url }
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  if (!consumeRateLimit(`tts-init:${auth.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many TTS requests" }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    const voice = body?.voice ? String(body.voice) : undefined;

    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    if (text.length > 10_000) {
      return NextResponse.json({ error: "text exceeds the 10000 character limit" }, { status: 413 });
    }

    // Create a short unique id. Prefer crypto.randomUUID when available.
    type CryptoWithRandom = { randomUUID?: () => string };
    const c =
      typeof crypto !== "undefined"
        ? (crypto as unknown as CryptoWithRandom)
        : undefined;
    const id =
      c && typeof c.randomUUID === "function"
        ? c.randomUUID()
        : Math.random().toString(36).slice(2);
    const signature = signStreamId(id);
    if (!signature) {
      return NextResponse.json({ error: "TTS streaming is not configured" }, { status: 503 });
    }
    // Store the payload for a short time; stream route will consume it.
    put(id, text, voice);

    const url = `/api/tts/stream?id=${encodeURIComponent(id)}&sig=${signature}`;
    return NextResponse.json({ id, url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "server error", message },
      { status: 500 }
    );
  }
}

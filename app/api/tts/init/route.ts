import { NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";
import { put } from "../store";

// POST /api/tts/init
// Body: { text, voice }
// Returns: { id, url }
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim();
    const voice = body?.voice ? String(body.voice) : undefined;

    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
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
    // Store the payload for a short time; stream route will consume it.
    put(id, text, voice);

    const url = `/api/tts/stream?id=${encodeURIComponent(id)}`;
    return NextResponse.json({ id, url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "server error", message },
      { status: 500 }
    );
  }
}

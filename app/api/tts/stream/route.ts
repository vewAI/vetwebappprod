import { NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";
import { takeAsync, peekAsync } from "../store";

// Streaming TTS proxy endpoint.
// Accepts GET?text=...&voice=... and forwards the streaming audio response
// from the upstream provider directly to the client so the browser can begin
// playback as soon as chunks arrive.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Support two modes:
    // 1) short-id mode: /api/tts/stream?id=<shortId> (POST-init flow)
    // 2) legacy mode: /api/tts/stream?text=...&voice=...
    const id = String(url.searchParams.get("id") ?? "").trim();
    let text = String(url.searchParams.get("text") ?? "");
    let voice = String(url.searchParams.get("voice") ?? "alloy");

    if (id) {
      // Peek so fallback fetches can reuse the payload until a successful stream
      const payload = await peekAsync(id);
      if (!payload) {
        return NextResponse.json(
          { error: "invalid or expired id" },
          { status: 404 }
        );
      }
      text = payload.text;
      voice = payload.voice ?? voice;
    }

    if (!id) {
      const auth = await requireUser(req);
      if ("error" in auth) {
        return auth.error;
      }
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Make a server-side POST to the TTS provider and forward the body.
    // We intentionally do NOT buffer the whole response here — we return
    // providerResponse.body directly so the client receives a streaming
    // response (chunked transfer). This allows the browser audio element to
    // begin playback earlier and reduce time-to-first-sound.
    const providerRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text }),
    });

    if (!providerRes.ok) {
      const detail = await providerRes.text().catch(() => "");
      return NextResponse.json(
        { error: "TTS provider error", detail },
        { status: 502 }
      );
    }

    // Forward the streaming body. Use the upstream content-type when available.
    const contentType = providerRes.headers.get("content-type") ?? "audio/mpeg";

    if (id) {
      // Clean up the stored payload now that the stream is ready
      void takeAsync(id);
    }

    // Return a streaming Response by directly returning the provider's body.
    return new Response(providerRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // No-cache by default to avoid browsers caching streaming audio.
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "server error", message },
      { status: 500 }
    );
  }
}

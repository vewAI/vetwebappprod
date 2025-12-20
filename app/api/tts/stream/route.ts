import { NextResponse } from "next/server";
import { debugEventBus } from "@/lib/debug-events-fixed";

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
    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;

    // Check if it's an ElevenLabs voice
    const elevenLabsVoices: Record<string, string> = {
      "charlie": "IKne3meq5aSn9XLyUdCD",
      "george": "JBFqnCBsd6RMkjVDRZzb",
      "harry": "SOYHLrjzK2X1ezoPC6cr",
      "alice": "Xb7hH8MSUJpSbSDYk0k2",
      "charlotte": "XB0fDUnXU5powFXDhCwa",
      "lily": "pFZP5JQG7iQjIQuC4Bku",
      "matilda": "XrExE9yKIg1WjnnlVkGX"
    };

    if (elevenLabsVoices[voice]) {
      if (ELEVENLABS_KEY) {
        const voiceId = elevenLabsVoices[voice];
        // Use the streaming endpoint
        const elevenLabsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          }),
        });

        if (elevenLabsRes.ok) {
           if (id) void takeAsync(id);
           return new Response(elevenLabsRes.body, {
             status: 200,
             headers: {
               "Content-Type": "audio/mpeg",
               "Cache-Control": "no-store",
             },
           });
        } else {
           const errText = await elevenLabsRes.text().catch(() => "");
           console.error(`[tts stream] ElevenLabs error (voice=${voice}):`, errText);
           // Fallback to OpenAI
           voice = "alloy";
        }
      } else {
         console.warn(`[tts stream] ElevenLabs key missing for voice ${voice}, falling back to OpenAI`);
         voice = "alloy";
      }
    }

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
    let providerRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ model: "tts-1", voice, input: text }),
    });

    // If tts-1 fails with model_not_found, try a series of fallbacks
    if (!providerRes.ok && providerRes.status === 400) {
       let errText = await providerRes.text().catch(() => "");
       if (errText.includes("model_not_found")) {
         debugEventBus.emitEvent("warning", "api/tts/stream", "tts-1 model not available, attempting fallbacks", { voice });
         console.warn("[tts stream] tts-1 model not found, retrying with tts-1-hd");
         providerRes = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({ model: "tts-1-hd", voice, input: text }),
          });

         if (!providerRes.ok && providerRes.status === 400) {
           errText = await providerRes.text().catch(() => "");
           if (errText.includes("model_not_found")) {
             console.warn("[tts stream] tts-1-hd model also not found, trying gpt-4o-mini-tts");
             debugEventBus.emitEvent("warning", "api/tts/stream", "tts-1-hd also unavailable, trying gpt-4o-mini-tts", { voice });
             providerRes = await fetch("https://api.openai.com/v1/audio/speech", {
               method: "POST",
               headers: {
                 Authorization: `Bearer ${OPENAI_KEY}`,
                 "Content-Type": "application/json",
                 Accept: "audio/mpeg",
               },
               body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text }),
             });
           }
         }
       } else {
         // If we can't retry, return the error response directly.
         console.error(`[tts stream] upstream 400 error: ${errText}`);
         debugEventBus.emitEvent("error", "api/tts/stream", "Upstream TTS provider returned 400", { detail: errText });
         return NextResponse.json(
            { error: "TTS provider error", detail: errText },
            { status: 502 }
         );
       }
    }

    if (!providerRes.ok) {
      const detail = await providerRes.text().catch(() => "");
      try {
        const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
        console.error(
          `[tts stream] upstream ${providerRes.status} ${providerRes.statusText} (voice=${voice}, chars=${text.length})\n${snippet}\n${detail}`
        );
      } catch (logError) {
        console.error("[tts stream] failed to log provider error", logError);
      }
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

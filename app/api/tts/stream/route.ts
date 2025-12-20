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

    // Make a server-side POST to OpenAI using only gpt-4o-mini-tts and forward the body.
    // If the upstream call fails, return a structured response indicating the
    // client should fallback to browser voices and include a suggested gender
    // for voice selection based on the requested voice.
    const suggestGenderFromVoice = (v: string) => {
      const female = ["alice", "charlotte", "lily", "matilda"];
      const male = ["charlie", "george", "harry"];
      if (female.includes(v)) return "female";
      if (male.includes(v)) return "male";
      return "neutral";
    };

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
      console.error(`[tts stream] gpt-4o-mini-tts error: ${detail}`);
      debugEventBus.emitEvent("error", "api/tts/stream", "gpt-4o-mini-tts unavailable", { voice, detail });
      return NextResponse.json(
        {
          error: "TTS provider unavailable",
          fallback: "browser",
          voiceRequested: voice,
          suggestedFallbackVoiceGender: suggestGenderFromVoice(voice),
          detail,
        },
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

import { NextResponse } from "next/server";
import { debugEventBus } from "@/lib/debug-events-fixed";

import { requireUser } from "@/app/api/_lib/auth";
import { takeAsync, peekAsync } from "../store";
import llm from "@/lib/llm";

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

    // Resolve which provider is configured for TTS (helps debugging when admin overrides are in play)
    let selectedProvider = "openai";
    try {
      selectedProvider = await llm.resolveProviderForFeature("tts");
    } catch (err) {
      console.warn("Failed to resolve TTS provider from config", err);
    }
    debugEventBus.emitEvent("info", "api/tts/stream", `Selected TTS provider: ${selectedProvider}`, { voice });

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

    // Prepare provider-specific routing. Try AI Studio or Gemini when selected,
    // otherwise fall back to OpenAI as before.
    const AISTUDIO_KEY = process.env.AISTUDIO_API_KEY;
    const AISTUDIO_TTS_URL = process.env.AISTUDIO_TTS_URL;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_TTS_URL = process.env.GEMINI_TTS_URL;

    const suggestGenderFromVoice = (v: string) => {
      const female = ["alice", "charlotte", "lily", "matilda"];
      const male = ["charlie", "george", "harry"];
      if (female.includes(v)) return "female";
      if (male.includes(v)) return "male";
      return "neutral";
    };

    // Try provider-specific TTS endpoints when configured
    let providerRes: Response | null = null;
    try {
      if (selectedProvider === "aistudio" && AISTUDIO_KEY && AISTUDIO_TTS_URL) {
        debugEventBus.emitEvent("info", "api/tts/stream", "Routing TTS to AI Studio", { voice, url: AISTUDIO_TTS_URL });
        providerRes = await fetch(AISTUDIO_TTS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AISTUDIO_KEY}`,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text, voice }),
        });
      } else if (selectedProvider === "gemini" && GEMINI_KEY && GEMINI_TTS_URL) {
        debugEventBus.emitEvent("info", "api/tts/stream", "Routing TTS to Gemini", { voice, url: GEMINI_TTS_URL });
        providerRes = await fetch(GEMINI_TTS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_KEY}`,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text, voice }),
        });
      }
    } catch (err: any) {
      console.error("TTS provider request failed:", err?.message ?? err);
      providerRes = null;
    }

    // If provider-specific request returned an OK response, forward it.
    if (providerRes && providerRes.ok) {
      const contentType = providerRes.headers.get("content-type") ?? "audio/mpeg";
      if (id) void takeAsync(id);
      return new Response(providerRes.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    // If we attempted to route to a provider but it failed, log and fall back to OpenAI below.
    if (selectedProvider !== "openai") {
      debugEventBus.emitEvent("warning", "api/tts/stream", `Provider ${selectedProvider} failed or not configured, falling back to OpenAI`, { voice });
    }

    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Make a server-side POST to OpenAI using gpt-4o-mini-tts and forward the body.
    // If the upstream call fails, return a structured response indicating the
    // client should fallback to browser voices and include a suggested gender
    // for voice selection based on the requested voice.

    // Reuse the earlier suggestGenderFromVoice definition above.
    providerRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text }),
    });

    if (!providerRes || !providerRes.ok) {
      const detail = providerRes ? await providerRes.text().catch(() => "") : "no response";
      console.error(`[tts stream] gpt-4o-mini-tts error: ${detail}`);
      debugEventBus.emitEvent("error", "api/tts/stream", `gpt-4o-mini-tts unavailable (provider=${selectedProvider})`, { voice, detail });
      return NextResponse.json(
        {
          error: "TTS provider unavailable",
          fallback: "browser",
          voiceRequested: voice,
          suggestedFallbackVoiceGender: ((): string => {
            const female = ["alice", "charlotte", "lily", "matilda"];
            const male = ["charlie", "george", "harry"];
            if (female.includes(voice)) return "female";
            if (male.includes(voice)) return "male";
            return "neutral";
          })(),
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

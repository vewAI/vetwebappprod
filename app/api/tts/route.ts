import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { debugEventBus } from "@/lib/debug-events-fixed";

// Server-side TTS proxy to a third-party TTS service (OpenAI/E2E)
// Expects JSON: { text: string, voice?: string }
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const body = await req.json();
    const text = String(body?.text ?? "");
    let voice = String(body?.voice ?? "alloy");

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
        const elevenLabsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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

        if (!elevenLabsRes.ok) {
          const errText = await elevenLabsRes.text();
          console.error("ElevenLabs error:", errText);
          // Fallback to OpenAI if ElevenLabs fails
          voice = "alloy";
        } else {
          const audioBuffer = await elevenLabsRes.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
            },
          });
        }
      } else {
        // ElevenLabs key missing, fallback to OpenAI
        console.warn("ElevenLabs key missing, falling back to OpenAI");
        voice = "alloy";
      }
    }

    if (!OPENAI_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Proxy to OpenAI TTS (Audio Speech endpoint). This code targets the
    // public OpenAI /v1/audio/speech endpoint which returns audio/mpeg by default.
    let openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice,
        input: text,
      }),
    });

    // If tts-1 fails with model_not_found, try tts-1-hd and then gpt-4o-mini-tts
    if (!openAiRes.ok && openAiRes.status === 400) {
       let errText = await openAiRes.text().catch(() => "");
       if (errText.includes("model_not_found")) {
         debugEventBus.emitEvent("warning", "api/tts", "tts-1 unavailable, attempting fallbacks", { voice });
         console.warn("tts-1 model not found, retrying with tts-1-hd");
         openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              model: "tts-1-hd",
              voice,
              input: text,
            }),
          });

         if (!openAiRes.ok && openAiRes.status === 400) {
           errText = await openAiRes.text().catch(() => "");
           if (errText.includes("model_not_found")) {
             console.warn("tts-1-hd not available, trying gpt-4o-mini-tts");
             debugEventBus.emitEvent("warning", "api/tts", "tts-1-hd unavailable, trying gpt-4o-mini-tts", { voice });
             openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
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
         console.error("OpenAI TTS error:", errText);
         debugEventBus.emitEvent("error", "api/tts", "OpenAI TTS returned 400", { detail: errText });
         return NextResponse.json(
            { error: "TTS provider error", detail: errText },
            { status: 502 }
         );
       }
    }

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
      console.error("OpenAI TTS error:", errText);
      return NextResponse.json(
        { error: "TTS provider error", detail: errText },
        { status: 502 }
      );
    }

    const arrayBuffer = await openAiRes.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": openAiRes.headers.get("content-type") ?? "audio/mpeg",
      },
    });
  } catch (err: unknown) {
    // Avoid using `any` in catch; normalize unknown to a string message
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "server error", message },
      { status: 500 }
    );
  }
}

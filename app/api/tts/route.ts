import { NextResponse } from "next/server";

// Server-side TTS proxy to a third-party TTS service (OpenAI/E2E)
// Expects JSON: { text: string, voice?: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text ?? "");
    const voice = String(body?.voice ?? "alloy");

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

    // Proxy to OpenAI TTS (Audio Speech endpoint). This code targets the
    // public OpenAI /v1/audio/speech endpoint which returns audio/mpeg by default.
    const openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
      }),
    });

    if (!openAiRes.ok) {
      const errText = await openAiRes.text();
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

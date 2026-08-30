import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

// Feedback/LLM calls can take >10s on OpenAI; raise the Vercel function limit.
export const maxDuration = 60;


// Repairs voice-input transcriptions that the Live model produced in the
// wrong language. The model itself always HEARS the original English audio —
// this only fixes the written transcript shown to the student.
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    if (!(await consumeRateLimit(`live-translate:${auth.user.id}`, 60, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.slice(0, 2000) : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      // Nothing to do — return the original so the caller keeps the entry.
      return NextResponse.json({ text });
    }

    const openai = await createOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Translate the user's words into natural English. Output ONLY the translation with no quotes, no explanations. Context: these are spoken transcriptions from a veterinary student during a clinical consultation simulation; preserve clinical meaning and proper nouns exactly.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const translated = response.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ text: translated || text });
  } catch (error) {
    console.error("Live translate failed:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}

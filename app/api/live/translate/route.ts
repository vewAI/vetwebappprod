import { NextResponse } from "next/server";
import { generateGeminiText } from "@/app/api/_lib/gemini";
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

    if (!process.env.GEMINI_API_KEY) {
      // Nothing to do — return the original so the caller keeps the entry.
      return NextResponse.json({ text });
    }

    const translated = await generateGeminiText({
      prompt: `A speech recognizer produced the text below while transcribing a veterinary student speaking ENGLISH (occasionally with Spanish words) during a clinical consultation simulation. The recognizer mistakenly wrote the sounds using a foreign script (Hangul, Cyrillic, Arabic, CJK, etc.) — it did NOT translate the meaning; it just chose wrong symbols for the sounds it heard.\n\nYour job: determine the most likely intended English words from their SOUND (phonetic reconstruction), as if the recognizer had used the Latin alphabet. Prefer veterinary clinical vocabulary (anatomy, tests, findings, treatments) when deciding what was said.\n\nOutput ONLY the reconstructed English text — no quotes, no explanations, no transliteration tables. If the input is already in Latin script, return it unchanged.\n\n${text}`,
      temperature: 0.2,
      maxOutputTokens: 500,
      timeoutMs: 20_000,
    });
    return NextResponse.json({ text: translated || text });
  } catch (error) {
    console.error("Live translate failed:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}

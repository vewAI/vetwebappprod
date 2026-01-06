import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import OpenAi from "openai";

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const auth = await requireUser(request as Request);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { caseId } = await context.params;
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName : "upload";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "text/plain";
  const contentBase64 = typeof body.contentBase64 === "string" ? body.contentBase64 : null;
  if (!contentBase64) return NextResponse.json({ error: "contentBase64 required" }, { status: 400 });

  // decode
  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch (e) {
    return NextResponse.json({ error: "Failed to decode base64" }, { status: 400 });
  }

  // extract text
  let text = "";
  try {
    if (mimeType === "application/pdf") {
      const data: any = await pdf(buffer as any);
      text = data.text || "";
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else if (mimeType.startsWith("text/") || mimeType === "application/json") {
      text = buffer.toString("utf-8");
    } else {
      // fallback to utf-8
      text = buffer.toString("utf-8");
    }
  } catch (err) {
    return NextResponse.json({ error: `Text extraction failed: ${String(err)}` }, { status: 500 });
  }

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "No text could be extracted from the file" }, { status: 400 });
  }

  // Load case
  const { data: caseRow, error: caseErr } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (caseErr) return NextResponse.json({ error: caseErr.message ?? "Failed to load case" }, { status: 500 });
  if (!caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // Call LLM to suggest updates. Reuse existing enrichment which returns a JSON of augmented fields.
  try {
    const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

    // Build a focused prompt: provide case JSON and uploaded text, ask for suggested field updates
    const promptSystem = "You are an expert veterinary educator. Compare the uploaded document to the case record and suggest concise JSON updates for any case fields that should change or be added. Return only a JSON object with key->value pairs for suggested updates. Include no commentary.";
    const userContent = JSON.stringify({ case: caseRow, uploaded_text_snippet: text.slice(0, 2000), uploaded_file_name: fileName });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_ENRICH_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 800,
    });

    const content = String(completion.choices?.[0]?.message?.content ?? "");
    if (!content.trim()) {
      return NextResponse.json({ message: "LLM returned no suggestions" });
    }

    // Try to parse JSON
    let suggested: Record<string, unknown> = {};
    try {
      suggested = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          suggested = JSON.parse(m[0]);
        } catch {
          // ignore parse failure
        }
      }
    }

    // Build diff
    const diffs: Record<string, { original: unknown; suggested: unknown }> = {};
    for (const [k, v] of Object.entries(suggested)) {
      const orig = caseRow[k];
      if (typeof v === "string" && String(v).trim() === "") continue;
      if (JSON.stringify(orig) !== JSON.stringify(v)) {
        diffs[k] = { original: orig, suggested: v };
      }
    }

    return NextResponse.json({ suggested, diffs, snippet: text.slice(0, 1000) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `LLM call failed: ${msg}` }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
// Use global fetch available in the runtime rather than node-fetch
import { normalizeCaseMedia } from "@/features/cases/models/caseMedia";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? null;

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // lazy import to avoid bundling unless used
  const pdfParse = await import("pdf-parse");
  const res = await (pdfParse as any)(buffer);
  return String(res.text || "");
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await (mammoth as any).extractRawText({ buffer });
  return String(res.value || "");
}

async function summarizeWithOpenAI(text: string, question: string) {
  if (!OPENAI_KEY) return null;
  try {
    const OpenAI = (await import("openai")).default ?? (await import("openai"));
    const client = new (OpenAI as any)({ apiKey: OPENAI_KEY });
    const prompt = `Summarize the following extracted text as it relates to the question:\n\nQuestion: ${question}\n\nText:\n${text}\n\nProvide a concise (2-4 sentence) summary and indicate if the text directly answers the question or not.`;
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });
    const output = resp.choices?.[0]?.message?.content ?? null;
    return output;
  } catch (err) {
    console.warn("OpenAI summarize failed", err);
    return null;
  }
}

export async function POST(req: Request, context: any) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { query } = body as { query?: string };
  if (!query || !query.trim()) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const caseId = context?.params?.caseId ?? (context?.params instanceof Promise ? (await context.params).caseId : undefined);
  const { supabase, adminSupabase } = auth;
  const db = adminSupabase ?? supabase;

  try {
    const { data: caseRow, error: fetchErr } = await db.from("cases").select("id, media").eq("id", caseId).maybeSingle();
    if (fetchErr) {
      console.error("Failed to load case for papers query", fetchErr);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    const media = normalizeCaseMedia((caseRow as any)?.media ?? []);
    const docs = media.filter((m) => m.type === "document");
    if (docs.length === 0) return NextResponse.json({ results: [] });

    const results: Array<any> = [];
    for (const doc of docs) {
      try {
        const url = doc.url;
        const resp = await fetch(url);
        if (!resp.ok) {
          results.push({ id: doc.id, url, caption: doc.caption, error: "fetch_failed" });
          continue;
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        let text = "";
        const mt = (doc.mimeType || "").toLowerCase();
        if (mt.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
          text = await extractTextFromPdf(buffer);
        } else if (mt.includes("word") || url.toLowerCase().endsWith(".docx") || url.toLowerCase().endsWith(".doc")) {
          text = await extractTextFromDocx(buffer);
        } else {
          // fallback: treat as plain text
          text = buffer.toString("utf8").slice(0, 20000);
        }

        const lower = text.toLowerCase();
        const score = query.split(/[^a-z0-9]+/i).reduce((s, token) => {
          if (!token) return s;
          const hits = (lower.match(new RegExp(token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []).length;
          return s + hits;
        }, 0);

        let summary = null;
        if (OPENAI_KEY && score >= 1) {
          const snippet = text.slice(0, 8000);
          summary = await summarizeWithOpenAI(snippet, query);
        }

        results.push({ id: doc.id, url, caption: doc.caption, mimeType: doc.mimeType, score, snippet: text.slice(0, 800), summary });
      } catch (err) {
        console.warn("Error processing doc", doc.id, err);
        results.push({ id: doc.id, url: doc.url, caption: doc.caption, error: String(err) });
      }
    }

    // sort by score desc
    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return NextResponse.json({ results });
  } catch (err) {
    console.error("papers query failed", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

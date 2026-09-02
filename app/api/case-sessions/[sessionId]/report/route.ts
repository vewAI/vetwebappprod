import { NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

export const maxDuration = 120;

type AttemptRow = {
  id: string;
  user_id: string;
  completion_status: string | null;
  time_spent_seconds: number | null;
  overall_feedback: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function stripTags(html: string): string {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await requireUser(_request);
    if ("error" in auth) {
      return auth.error;
    }
    if (auth.role !== "professor" && auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await consumeRateLimit(`session-report:${auth.user.id}`, 6, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const { supabase } = auth;

    // Load the session and verify ownership (professor who created it).
    const { data: session, error: sessionError } = await supabase
      .from("case_sessions")
      .select("id, case_id, name, created_by")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (auth.role !== "admin" && session.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load the session's completed attempts with student identities and AI feedback.
    const { data: attempts, error: attemptsError } = await supabase
      .from("attempts")
      .select(
        "id, user_id, completion_status, time_spent_seconds, overall_feedback, profiles!attempts_profiles_user_id_fkey(full_name, email)"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(60);

    if (attemptsError) {
      return NextResponse.json({ error: attemptsError.message }, { status: 500 });
    }

    const rows = (attempts ?? []) as unknown as AttemptRow[];
    const completed = rows.filter(
      (a) => a.completion_status === "completed" && stripTags(a.overall_feedback ?? "").length > 20
    );

    if (completed.length === 0) {
      return NextResponse.json(
        { error: "No completed sessions with feedback yet. Students must finish the case first." },
        { status: 400 }
      );
    }

    // Load the case's learning objectives.
    const { data: caseRow } = await supabase
      .from("cases")
      .select("learning_objectives")
      .eq("id", session.case_id)
      .maybeSingle();
    const objectives = String(caseRow?.learning_objectives ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 3)
      .slice(0, 12);

    // Per-student summaries for the prompt.
    const perStudent = completed
      .slice(0, 40)
      .map((a, i) => {
        const name = a.profiles?.full_name ?? a.profiles?.email ?? `Student ${i + 1}`;
        const feedback = stripTags(a.overall_feedback ?? "").slice(0, 1_500);
        const minutes = Math.round((a.time_spent_seconds ?? 0) / 60);
        return `STUDENT ${i + 1}: ${name} (${minutes} min)\n${feedback}`;
      })
      .join("\n\n");

    const objectivesSection = objectives.length
      ? `\nLEARNING OBJECTIVES for this case:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\nInclude a section assessing class performance per objective.`
      : "";

    const prompt = `You are an academic coordinator preparing a debrief for a veterinary professor after a simulated-consultation class.

Below are the AI-generated feedback reports of ${completed.length} students who each completed the same clinical case ("${session.name}").

Write a GROUP DEBRIEF REPORT in English, in Markdown, with these sections:
1. **Class overview** — 2-3 sentences on how the group performed overall.
2. **Common strengths** — 3-4 bullets.
3. **Common weak points** — 3-5 bullets, ranked by how many students show each issue.
${objectives.length ? `4. **Learning objectives performance** — one line per objective: what % of students covered it and typical gaps.` : ""}
${objectives.length ? "5" : "4"}. **Recommended discussion topics for the wrap-up** — 3-5 concrete topics the professor should cover in class, based on the most frequent mistakes.

Be concrete and reference actual behaviours seen in the reports. Do not invent students or events that are not in the material.

${objectivesSection}

--- STUDENT FEEDBACK REPORTS ---
${perStudent}`;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI service is not configured" }, { status: 503 });
    }

    const openai = await createOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.4,
      max_tokens: 2500,
    });
    const report = response.choices?.[0]?.message?.content ?? "";
    if (!report.trim()) {
      return NextResponse.json({ error: "The AI returned an empty report" }, { status: 502 });
    }

    // Render markdown and sanitize exactly like the student feedback endpoints.
    const [{ default: DOMPurify }, { marked }] = await Promise.all([
      import("isomorphic-dompurify"),
      import("marked"),
    ]);
    const renderedHtml = marked.parse(report, { gfm: true, breaks: true }) as string;
    const reportHtml = DOMPurify.sanitize(renderedHtml, {
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "h4", "p", "br", "strong", "em", "ul", "ol", "li",
        "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td",
      ],
      ALLOWED_ATTR: [],
    });

    return NextResponse.json({ report: reportHtml, students: completed.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Session group report failed:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

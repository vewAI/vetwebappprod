import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await request.json();
  if (!studentId || typeof studentId !== "string") {
    return NextResponse.json(
      { error: "studentId is required" },
      { status: 400 }
    );
  }

  const { adminSupabase } = auth;
  if (!adminSupabase) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 500 }
    );
  }

  // Fetch student profile
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", studentId)
    .maybeSingle();

  const studentName = profile?.full_name ?? profile?.email ?? studentId;

  // Fetch all completed attempts with AI feedback, chronologically
  const { data: attempts, error: attemptsErr } = await adminSupabase
    .from("attempts")
    .select("id, case_id, title, completion_status, overall_feedback, created_at, time_spent_seconds, cases(title)")
    .eq("user_id", studentId)
    .eq("completion_status", "completed")
    .not("overall_feedback", "is", null)
    .order("created_at", { ascending: true });

  if (attemptsErr) {
    return NextResponse.json({ error: attemptsErr.message }, { status: 500 });
  }

  if (!attempts || attempts.length === 0) {
    return NextResponse.json({
      analysis:
        "No completed attempts with AI feedback found for this student. The student needs to complete at least one case with AI feedback before an evolution analysis can be generated.",
    });
  }

  // Build context from attempts
  const attemptsContext = attempts
    .map((a: Record<string, unknown>, i: number) => {
      const caseData = a.cases as Record<string, unknown> | undefined;
      const caseTitle = (caseData?.title as string) ?? (a.title as string) ?? "Unknown Case";
      const feedback = (a.overall_feedback as string) ?? "No feedback available";
      const date = new Date(a.created_at as string).toLocaleDateString();
      const timeMin = Math.round(((a.time_spent_seconds as number) ?? 0) / 60);

      return `--- Attempt ${i + 1} ---
Case: ${caseTitle}
Date: ${date}
Time Spent: ${timeMin} minutes
AI Feedback:
${feedback}`;
    })
    .join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      analysis: `Evolution analysis for ${studentName}:\n\n${attemptsContext}\n\n[AI analysis unavailable — OPENAI_API_KEY not configured]`,
    });
  }

  const systemPrompt = `You are an experienced veterinary education analyst. A professor has asked you to analyze a student's evolution across their case attempts.

Student: ${studentName}
Number of completed attempts with feedback: ${attempts.length}

Your task:
1. Identify the student's STRENGTHS that appear consistently across attempts
2. Identify AREAS OF IMPROVEMENT that persist across attempts
3. Track PROGRESSION — has the student improved over time? In which areas?
4. Highlight specific COMPETENCIES that need attention (history-taking, physical exam, diagnostics, client communication)
5. Provide ACTIONABLE RECOMMENDATIONS for the professor to support this student
6. Give an overall ASSESSMENT of the student's trajectory

Be specific, constructive, and evidence-based. Reference actual feedback content when making observations. Write in clear, professional English.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here are the student's completed case attempts with AI feedback, in chronological order:\n\n${attemptsContext}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const analysis = response.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ analysis });
  } catch (aiErr) {
    console.error("OpenAI call failed for student evolution:", aiErr);
    return NextResponse.json(
      { error: "Failed to generate evolution analysis. Please try again." },
      { status: 500 }
    );
  }
}

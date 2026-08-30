import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { feedbackPromptRegistry } from "@/features/feedback/feedback-prompts";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) return auth.error;
    if (!(await consumeRateLimit(`feedback:${auth.user.id}`, 5, 60_000))) {
      return NextResponse.json({ error: "Too many feedback requests" }, { status: 429 });
    }

    const body = await request.json();
    const { messages, stageIndex, caseId, feedbackPromptKey, attemptId } = body ?? {};

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
      return NextResponse.json({ error: "Messages must contain between 1 and 100 items" }, { status: 400 });
    }
    if (messages.some((message) => !message || typeof message.content !== "string" || message.content.length > 8_000)) {
      return NextResponse.json({ error: "Each message must contain at most 8000 characters" }, { status: 400 });
    }
    if (typeof attemptId !== "string" || attemptId.length > 200) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }
    if (typeof caseId !== "string" || caseId.length > 200 || typeof feedbackPromptKey !== "string" || feedbackPromptKey.length > 100) {
      return NextResponse.json({ error: "caseId and feedbackPromptKey are required" }, { status: 400 });
    }

    const access = await authorizeAttemptAccess(
      auth.adminSupabase ?? auth.supabase,
      attemptId,
      auth.user.id,
      auth.role,
    );
    if (access.error) return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    if (access.notFound) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (access.attempt?.case_id && access.attempt.case_id !== caseId) {
      return NextResponse.json({ error: "Attempt does not belong to this case" }, { status: 403 });
    }

    const promptFactory = feedbackPromptRegistry[caseId]?.[feedbackPromptKey];
    if (typeof promptFactory !== "function") {
      return NextResponse.json({ error: "Unsupported feedback prompt" }, { status: 400 });
    }
    const context = messages
      .map((message: { role?: string; content: string; displayRole?: string }, index: number) =>
        `Turn ${index + 1} | ${message.displayRole ?? message.role ?? "Assistant"}: ${message.content}`,
      )
      .join("\n\n");
    const { data: caseRow } = await (auth.adminSupabase ?? auth.supabase)
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    // Prompt instructions come from the server-side registry. The client can
    // provide transcript data, but cannot replace the evaluation rubric.
    const feedbackPrompt = (promptFactory as unknown as (
      caseRow: Record<string, unknown> | null,
      context: string,
    ) => string)(caseRow as Record<string, unknown> | null, context);

    // Create validated OpenAI client for this request
    let openai: any;
    try {
      openai = await createOpenAIClient();
    } catch (err: any) {
      console.error("OpenAI client creation failed for feedback API:", err);
      return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: feedbackPrompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const feedbackContent = response.choices[0].message.content || "No feedback available.";
    const renderedFeedback = marked.parse(feedbackContent, { gfm: true, breaks: true }) as string;
    const wrappedFeedback = DOMPurify.sanitize(renderedFeedback, {
      ALLOWED_TAGS: ["h1", "h2", "h3", "p", "br", "strong", "em", "ul", "ol", "li", "code", "pre", "blockquote"],
      ALLOWED_ATTR: [],
    });

    // Save through the already-authorized server client, not an ambient anon
    // client that has no request token attached.
    const writeClient = auth.adminSupabase ?? auth.supabase;
    const { error: saveError } = await writeClient.from("attempt_feedback").insert({
      attempt_id: attemptId,
      stage_index: typeof stageIndex === "number" ? Math.max(0, Math.floor(stageIndex)) : 0,
      feedback_content: wrappedFeedback,
    });
    const saveResult = !saveError;
    if (saveError) console.error("Failed to save feedback to database", saveError);

    if (!saveResult) {
      console.error("Failed to save feedback to database");
      // Continue anyway to return the feedback to the client
    }

    return NextResponse.json({
      feedback: wrappedFeedback,
      saved: saveResult,
    });
  } catch (error) {
    console.error("Error in feedback API:", error);
    const errorMessage = `<p>At this moment it is still not possible to generate feedback. Please try again later.</p>`;
    return NextResponse.json(
      {
        feedback: errorMessage,
        error: "Failed to generate feedback",
      },
      { status: 500 },
    );
  }
}

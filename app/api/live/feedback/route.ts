import { NextResponse } from "next/server";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { getLiveFeedbackPrompt } from "@/features/role-info/db-role-info";
import { requireUser } from "@/app/api/_lib/auth";
import type { Message } from "@/features/chat/models/chat";

function formatTranscript(messages: Message[]): string {
  return messages
    .map((entry, i) => {
      const speaker = entry.role === "user" ? "Student" : "Persona";
      return `Turn ${i + 1} | ${speaker}: ${entry.content}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth;
    const { caseId, messages } = (await request.json()) as {
      caseId: string;
      messages: Message[];
    };

    if (!caseId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        feedback:
          "<p>Session ended with no recorded interaction. Feedback requires at least one exchange.</p>",
      });
    }

    const context = formatTranscript(messages);

    // Fetch case row for per-case prompt overrides
    let caseRow: Record<string, unknown> | null = null;
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .maybeSingle();
      if (!error && data) caseRow = data as Record<string, unknown>;
    } catch (e) {
      console.warn("Could not fetch case row for live feedback:", e);
    }

    const feedbackPrompt = getLiveFeedbackPrompt(caseRow, context);

    // Fallback when OpenAI is not configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY not set; returning fallback live feedback");
      const fallback = `<p>Live session completed. Automated detailed feedback is unavailable because the AI service is not configured. Here are a few communication review points:</p><ul><li>Did you greet the owner and establish the reason for the consultation?</li><li>Did you use open questions first, then focused questions?</li><li>Did you acknowledge the owner's concerns and emotions?</li><li>Did you explain your reasoning and check understanding?</li><li>Did you communicate clearly with the veterinary nurse or team?</li></ul><p>Please enable the OpenAI API key to generate richer, tailored feedback.</p>`;
      return NextResponse.json({ feedback: fallback });
    }

    // Generate feedback via OpenAI
    let feedbackContent = "";

    let openai: Awaited<ReturnType<typeof createOpenAIClient>> | null = null;
    try {
      openai = await createOpenAIClient();
    } catch (clientErr) {
      console.error("OpenAI client creation failed for live feedback:", clientErr);
      feedbackContent =
        "Live session completed. Automated detailed feedback is currently unavailable. Please enable a valid OpenAI API key.";
    }

    if (openai) {
      try {
        const promptToSend = `${feedbackPrompt}\n\nTRANSCRIPT ROLE INTERPRETATION (STRICT):\n- Treat "Student" as the learner.\n- Treat "Persona" as the simulated role (owner, veterinary nurse, or other team member depending on the stage).\n- Evaluate the student's communication with ALL persona roles they interacted with.`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: promptToSend }],
          temperature: 0.7,
          max_tokens: 2000,
        });
        feedbackContent = response.choices?.[0]?.message?.content ?? "";
      } catch (aiErr) {
        console.error("OpenAI call failed for live feedback:", aiErr);
        feedbackContent =
          "Live session completed. Automated detailed feedback is currently unavailable due to an upstream error. Consider reviewing your conversation flow, questioning technique, and empathy in future sessions.";
      }
    }

    // Render markdown via `marked` and sanitize with DOMPurify so OpenAI
    // generated HTML/scripts cannot reach the client. The previous regex
    // chain had no sanitization — a prompt-injection in the LLM response
    // could land <script> tags in the DOM.
    const renderedHtml = marked.parse(feedbackContent, {
      gfm: true,
      breaks: true,
    }) as string;
    const wrappedFeedback = DOMPurify.sanitize(renderedHtml, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "br",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
      ],
      ALLOWED_ATTR: [],
    });

    return NextResponse.json({ feedback: wrappedFeedback });
  } catch (error) {
    console.error("Error generating live feedback:", error);
    return NextResponse.json(
      {
        feedback: "<p>Unable to generate feedback at this time. Please try again later.</p>",
        error: "Failed to generate feedback",
      },
      { status: 500 }
    );
  }
}

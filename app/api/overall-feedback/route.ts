import { NextResponse } from "next/server";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { case1RoleInfo } from "@/features/role-info/case1";
import type { Message } from "@/features/chat/models/chat";
import { requireUser } from "@/app/api/_lib/auth";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

function resolveSpeakerLabel(msg: Message): string {
  if (msg.role === "user") {
    return "Student";
  }

  const display = typeof msg.displayRole === "string" ? msg.displayRole.trim() : "";
  const persona = typeof msg.personaRoleKey === "string" ? msg.personaRoleKey.trim() : "";

  if (persona === "veterinary-nurse") {
    return display && !/nurse/i.test(display) ? `Veterinary Nurse (${display})` : "Veterinary Nurse";
  }

  if (persona === "owner") {
    return display && !/owner|client/i.test(display) ? `Client (Owner: ${display})` : "Client (Owner)";
  }

  if (persona === "lab-technician") {
    return display && !/lab|technician/i.test(display) ? `Laboratory Technician (${display})` : "Laboratory Technician";
  }

  if (display) {
    return display;
  }

  return "Assistant";
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    if (!(await consumeRateLimit(`overall-feedback:${auth.user.id}`, 3, 60_000))) {
      return NextResponse.json({ error: "Too many feedback requests" }, { status: 429 });
    }
    const { supabase } = auth;
    const { caseId, messages } = await request.json();
    if (typeof caseId !== "string" || caseId.length > 200 || !Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
      return NextResponse.json({ error: "Invalid feedback request" }, { status: 400 });
    }
    if (messages.some((message: Message) => !message || typeof message.content !== "string" || message.content.length > 8_000)) {
      return NextResponse.json({ error: "Message content exceeds the allowed limit" }, { status: 400 });
    }

    console.log("Generating overall feedback for case:", caseId);

    // Format messages into a context string for the feedback prompt
    const context = messages
      .map((msg: Message, index: number) => {
        const speaker = resolveSpeakerLabel(msg);
        const turn = index + 1;
        return `Turn ${turn} | ${speaker}: ${msg.content}`;
      })
      .join("\n\n");

    // Fetch case row so we can inject case-specific prompts when available
    let caseRow: Record<string, unknown> | null = null;
    try {
      const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
      if (!error && data) caseRow = data as Record<string, unknown>;
    } catch (e) {
      console.warn("Could not fetch case row for overall feedback:", e);
    }

    // Get the appropriate prompt based on case ID
    let feedbackPrompt: string | undefined;

    // Try to get prompt from case row first (for dynamic cases)
    if (caseRow) {
      const rolePrompts = (caseRow.role_prompts as Record<string, string>) || {};
      if (rolePrompts.get_overall_feedback_prompt) {
        feedbackPrompt = rolePrompts.get_overall_feedback_prompt;
      }
    }

    // Fallback for hardcoded cases if not found in DB
    if (!feedbackPrompt && caseId === "case-1") {
      if (typeof case1RoleInfo.getOverallFeedbackPrompt === "function") {
        // If the function accepts two args, pass caseRow first
        const fn = case1RoleInfo.getOverallFeedbackPrompt as unknown;
        if (typeof fn === "function") {
          const typedFn = fn as (...args: unknown[]) => string;
          if (typedFn.length >= 2) {
            feedbackPrompt = typedFn(caseRow, context);
          } else {
            feedbackPrompt = typedFn(context);
          }
        }
      } else {
        //use directly as string if not function
        feedbackPrompt = case1RoleInfo.getOverallFeedbackPrompt as unknown as string;
      }
    }

    // Generic fallback if still no prompt
    if (!feedbackPrompt) {
      feedbackPrompt = `Please provide constructive feedback for the student's performance using the context below. Focus on history taking, physical exam thoroughness, diagnostic reasoning, and client communication.\n\n${context}`;
    }

    // If OpenAI API key is not configured, return a helpful fallback
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is not set; returning fallback overall feedback");
      const fallback = `<p>Examination completed. Automated detailed feedback is unavailable because the AI service is not configured. Here are a few suggestions you can review:</p><ul><li>Did you collect a clear history and relevant risk factors?</li><li>Were your physical examination findings systematic and documented?</li><li>Were test selections justified and prioritized?</li><li>Did you communicate next steps and biosecurity clearly to the client?</li></ul><p>Please enable the OpenAI API key to generate richer, tailored feedback.</p>`;
      return NextResponse.json({ feedback: fallback });
    }

    // Generate feedback using OpenAI (wrapped in try/catch to allow fallback)
    let feedbackContent = "";

    // Create validated OpenAI client; if creation fails, log and fall back to conservative feedback
    let openai: any = null;
    try {
      openai = await createOpenAIClient();
    } catch (clientErr) {
      console.error("OpenAI client creation failed for overall feedback:", clientErr);
      feedbackContent = `Examination completed. Automated detailed feedback is currently unavailable because the AI service is not configured correctly. Please enable a valid OpenAI API key.`;
    }

    if (openai) {
      try {
        const promptToSend = `${feedbackPrompt ?? `Please provide constructive feedback for the student's performance using the context below:\n\n${context}`}\n\nTRANSCRIPT ROLE INTERPRETATION (STRICT):\n- Treat "Student" as the learner.\n- Treat "Client (Owner...)" as owner/client persona turns.\n- Treat "Veterinary Nurse (...)" as nurse persona turns, NOT as owner/client.\n- Do not merge owner and nurse into a single "client" role when evaluating communication.`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: promptToSend }],
          temperature: 0.7,
          max_tokens: 2000,
        });
        feedbackContent = response.choices?.[0]?.message?.content ?? "";
      } catch (aiErr) {
        console.error("OpenAI call failed for overall feedback:", aiErr);
        // Provide a conservative fallback feedback so the UI still shows something
        feedbackContent = `Examination completed. Automated detailed feedback is currently unavailable due to an upstream error. Consider the following review points:\n\n- History: Was sufficient information gathered from the client?\n- Physical exam: Were findings documented and prioritized?\n- Diagnostics: Were test requests appropriate and justified?\n- Client communication: Were recommendations and biosecurity clearly explained?\n\nPlease try again later or enable the AI service for full feedback.`;
      }
    }

    // Render markdown via `marked` and sanitize with DOMPurify so LLM-generated
    // HTML/scripts cannot reach the client. The previous regex chain had no
    // sanitization — prompt injection in the LLM response could land markup
    // that is later rendered with dangerouslySetInnerHTML.
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
    console.error("Error generating overall feedback:", error);
    const errorMessage = `<p>Unable to generate feedback at this time. Please try again later.</p>`;
    return NextResponse.json({ feedback: errorMessage, error: "Failed to generate feedback" }, { status: 500 });
  }
}

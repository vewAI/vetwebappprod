import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { case1RoleInfo } from "@/features/role-info/case1";
import type { Message } from "@/features/chat/models/chat";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth;
    const { caseId, messages } = await request.json();

    console.log("Generating overall feedback for case:", caseId);

    // Format messages into a context string for the feedback prompt
    const context = messages
      .map((msg: Message) => {
        const role =
          msg.role === "user" ? "Student" : msg.displayRole || "Assistant";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    // Fetch case row so we can inject case-specific prompts when available
    let caseRow: Record<string, unknown> | null = null;
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .maybeSingle();
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
        feedbackPrompt =
          case1RoleInfo.getOverallFeedbackPrompt as unknown as string;
      }
    } 
    
    // Generic fallback if still no prompt
    if (!feedbackPrompt) {
       feedbackPrompt = `Please provide constructive feedback for the student's performance using the context below. Focus on history taking, physical exam thoroughness, diagnostic reasoning, and client communication.\n\n${context}`;
    }

    // If OpenAI API key is not configured, return a helpful fallback
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY is not set; returning fallback overall feedback"
      );
      const fallback = `<p>Examination completed. Automated detailed feedback is unavailable because the AI service is not configured. Here are a few suggestions you can review:</p><ul><li>Did you collect a clear history and relevant risk factors?</li><li>Were your physical examination findings systematic and documented?</li><li>Were test selections justified and prioritized?</li><li>Did you communicate next steps and biosecurity clearly to the client?</li></ul><p>Please enable the OpenAI API key to generate richer, tailored feedback.</p>`;
      return NextResponse.json({ feedback: fallback });
    }

    // Generate feedback using OpenAI (wrapped in try/catch to allow fallback)
    let feedbackContent = "";
    try {
      const promptToSend =
        feedbackPrompt ??
        `Please provide constructive feedback for the student's performance using the context below:\n\n${context}`;
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

    // Format the feedback with simple HTML using regex replacements
    const formattedFeedback = feedbackContent
      .replace(/\n\n/g, "</p><p>") // Convert double line breaks to paragraphs
      .replace(/\n/g, "<br>") // Convert single line breaks to <br>
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold text
      .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic text
      .replace(/^#\s+(.*?)$/gm, "<h1>$1</h1>") // H1
      .replace(/^##\s+(.*?)$/gm, "<h2>$1</h2>") // H2
      .replace(/^###\s+(.*?)$/gm, "<h3>$1</h3>") // H3
      .replace(/^(\d+\.\s+.*?)$/gm, "<li>$1</li>") // Numbered lists
      .replace(/^-\s+(.*?)$/gm, "<li>$1</li>"); // Bullet points

    const wrappedFeedback = `<p>${formattedFeedback}</p>`
      .replace(/<p><h([1-3])>/g, "<h$1>") // Fix nested paragraph tags
      .replace(/<\/h([1-3])><\/p>/g, "</h$1>") // Fix nested paragraph tags
      .replace(/<p><li>/g, "<li>") // Fix nested paragraph tags
      .replace(/<\/li><\/p>/g, "</li>") // Fix nested paragraph tags
      .replace(/<p><\/p>/g, ""); // Remove empty paragraphs

    return NextResponse.json({ feedback: wrappedFeedback });
  } catch (error) {
    console.error("Error generating overall feedback:", error);
    const errorMessage = `<p>Unable to generate feedback at this time. Please try again later.</p>`;
    return NextResponse.json(
      { feedback: errorMessage, error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}

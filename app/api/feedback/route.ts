import { NextRequest, NextResponse } from "next/server";
import OpenAi from "openai";
import { saveFeedback } from "@/features/attempts/services/attemptService";

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      stageIndex,
      feedbackPrompt: feedbackPromptFromClient,
      attemptId,
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    if (!attemptId) {
      return NextResponse.json(
        { error: "attemptId is required" },
        { status: 400 }
      );
    }

    // Require the prompt to be provided by the client
    const feedbackPrompt = feedbackPromptFromClient;
    if (!feedbackPrompt) {
      return NextResponse.json(
        { error: "feedbackPrompt is required in the request body." },
        { status: 400 }
      );
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: feedbackPrompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Format the feedback with HTML
    const feedbackContent =
      response.choices[0].message.content || "No feedback available.";

    // Convert markdown-like formatting to HTML
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

    // Wrap in paragraph tags if not already done
    const wrappedFeedback = `<p>${formattedFeedback}</p>`
      .replace(/<p><h([1-3])>/g, "<h$1>") // Fix nested paragraph tags
      .replace(/<\/h([1-3])><\/p>/g, "</h$1>") // Fix nested paragraph tags
      .replace(/<p><li>/g, "<li>") // Fix nested paragraph tags
      .replace(/<\/li><\/p>/g, "</li>") // Fix nested paragraph tags
      .replace(/<p><\/p>/g, ""); // Remove empty paragraphs

    // Save the feedback to the database
    const saveResult = await saveFeedback(
      attemptId,
      stageIndex,
      wrappedFeedback
    );

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
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

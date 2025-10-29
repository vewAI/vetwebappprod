import OpenAi from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRoleInfoPrompt } from "@/features/role-info/services/roleInfoService";
import { createClient } from "@supabase/supabase-js";

// Create a Supabase server client using the service role key when available.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, stageIndex, caseId } = await request.json();

    // Validate that messages is an array
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === "user");
    const enhancedMessages = [...messages];

    // If we have a valid caseId, fetch owner_background and roleInfo and prepend them
    // so the LLM is influenced by the owner's personality plus any stage-specific role info.
    if (caseId) {
      let ownerBackground: string | null = null;
      try {
        const { data: caseRow, error: caseErr } = await supabase
          .from("cases")
          .select("owner_background")
          .eq("id", caseId)
          .maybeSingle();

        if (caseErr) {
          console.warn(
            "Could not fetch case owner_background:",
            caseErr.message ?? caseErr
          );
        } else if (caseRow && caseRow.owner_background) {
          ownerBackground = String(caseRow.owner_background);
        }
      } catch (e) {
        console.warn("Error fetching owner_background for caseId", caseId, e);
      }

      // Stage-specific role info
      if (stageIndex !== undefined && lastUserMessage) {
        const roleInfoPrompt = getRoleInfoPrompt(
          caseId,
          stageIndex,
          lastUserMessage.content
        );

        if (roleInfoPrompt) {
          // Unshift role info first; ownerBackground will be unshifted after to ensure it
          // appears first in the message list (highest priority personality instruction).
          enhancedMessages.unshift({ role: "system", content: roleInfoPrompt });
        }
      }

      if (ownerBackground) {
        enhancedMessages.unshift({ role: "system", content: ownerBackground });
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: enhancedMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantContent = response.choices[0].message.content;

    // Derive a concise displayRole from ownerBackground when available so
    // the UI can show a per-case label (e.g. "Client (Catalina's Owner)").
    let displayRole: string | undefined = undefined;
    if (ownerBackground) {
      // Try to extract a "Role:" line from the owner background template
      const roleMatch = ownerBackground.match(/Role:\s*(.+)/i);
      if (roleMatch && roleMatch[1]) {
        displayRole = roleMatch[1].trim();
      } else {
        // If Role isn't present, try to extract a Horse name and use Owner (Name)
        const horseMatch = ownerBackground.match(/Horse:\s*([^\n]+)/i);
        if (horseMatch && horseMatch[1]) {
          const horseName = horseMatch[1].split("(")[0].trim();
          displayRole = `Owner (${horseName})`;
        } else {
          displayRole = "Client (Owner)";
        }
      }
    }

    return NextResponse.json({
      content: assistantContent,
      displayRole,
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

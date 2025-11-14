import OpenAi from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRoleInfoPrompt } from "@/features/role-info/services/roleInfoService";
import { getStagesForCase } from "@/features/stages/services/stageService";
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
    let ownerBackground: string | null = null;
    if (caseId) {
      try {
        const { data: caseRow, error: caseErr } = await supabase
          .from("cases")
          // fetch title so we can substitute placeholders like [Your Name]
          .select("owner_background,title")
          .eq("id", caseId)
          .maybeSingle();

        if (caseErr) {
          console.warn(
            "Could not fetch case owner_background:",
            caseErr.message ?? caseErr
          );
        } else if (caseRow && caseRow.owner_background) {
          ownerBackground = String(caseRow.owner_background);
          // Replace common placeholder markers the prompts may contain so the
          // LLM doesn't echo things like "[Your Name]" literally. Prefer the
          // case title (usually the horse name) when available, otherwise fall
          // back to a neutral label.
          const titleFromRow = (caseRow as { title?: string } | null)?.title;
          const replacement =
            titleFromRow && String(titleFromRow).trim() !== ""
              ? String(titleFromRow)
              : "Owner";
          ownerBackground = ownerBackground.replace(
            /\[Your Name\]/g,
            replacement
          );
          ownerBackground = ownerBackground.replace(
            /\{owner_name\}/g,
            replacement
          );
        }
      } catch (e) {
        console.warn("Error fetching owner_background for caseId", caseId, e);
      }

      // Stage-specific role info
      if (stageIndex !== undefined && lastUserMessage) {
        const roleInfoPrompt = await getRoleInfoPrompt(
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

    // High-priority system guideline to shape assistant tone and avoid
    // verbose, repetitive, or overly-polite filler. Keep replies natural,
    // concise, and human-like. Avoid phrases like "Thank you for asking"
    // or "What else would you like to know about X?" unless explicitly
    // requested. Do not prematurely summarize or provide full diagnostic
    // conclusions unless the student asks; when asked for a summary produce
    // a concise bulleted list or a markdown table on request.
    const systemGuideline = `You are a concise, human-like veterinary assistant. Avoid filler and unnecessary pleasantries. Do not use phrases such as "Thank you for asking" or "What else would you like to know" unless directly requested. Keep responses brief, natural, and focused. Do not provide final summaries or diagnostic conclusions unless the student explicitly requests them; when asked to summarize, produce a short bulleted list or a markdown table if requested.

When the student provides physical examination findings, they may use shorthand, non-standard phrases, or list items out of order. Always interpret the intent of the student's input flexibly, address observations in the order presented when reasonable, and ask concise clarifying questions if needed. Incorporate any indications the student gives and respond fluently and directly to each point the student raises.`;

    enhancedMessages.unshift({ role: "system", content: systemGuideline });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: enhancedMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantContent = response.choices[0].message.content;

    // Prefer the configured stage role label when available (so the UI shows
    // e.g. "Laboratory Technician" for the Test Results stage). Only derive
    // an owner-specific label from the ownerBackground when the current stage
    // role is the client/owner; otherwise use the stage role directly.
    let displayRole: string | undefined = undefined;
    try {
      if (caseId !== undefined && typeof stageIndex === "number") {
        const stages = getStagesForCase(caseId);
        const stage = stages && stages[stageIndex];
        if (stage && stage.role) {
          // If the stage role refers to the owner/client and we have an
          // ownerBackground, derive a friendly label using the horse name.
          if (/owner|client/i.test(stage.role) && ownerBackground) {
            const roleMatch = ownerBackground.match(/Role:\s*(.+)/i);
            if (roleMatch && roleMatch[1]) {
              displayRole = roleMatch[1].trim();
            } else {
              const horseMatch = ownerBackground.match(/Horse:\s*([^\n]+)/i);
              if (horseMatch && horseMatch[1]) {
                const horseName = horseMatch[1].split("(")[0].trim();
                displayRole = `Owner (${horseName})`;
              } else {
                displayRole = stage.role;
              }
            }
          } else {
            // Use the stage role (e.g., "Laboratory Technician")
            displayRole = stage.role;
          }
        }
      }
    } catch {
      // Fallback to the old ownerBackground-derived label if anything goes wrong
      if (ownerBackground) {
        const roleMatch = ownerBackground.match(/Role:\s*(.+)/i);
        if (roleMatch && roleMatch[1]) {
          displayRole = roleMatch[1].trim();
        } else {
          const horseMatch = ownerBackground.match(/Horse:\s*([^\n]+)/i);
          if (horseMatch && horseMatch[1]) {
            const horseName = horseMatch[1].split("(")[0].trim();
            displayRole = `Owner (${horseName})`;
          } else {
            displayRole = "Client (Owner)";
          }
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

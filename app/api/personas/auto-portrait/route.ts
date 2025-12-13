import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getOrGeneratePersonaPortrait } from "@/features/personas/services/personaImageService";
import { SHARED_CASE_ID } from "@/features/personas/services/personaSeedService";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roleKey, caseId } = body;

    if (!roleKey) {
      return NextResponse.json({ error: "Missing roleKey" }, { status: 400 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    
    // If caseId is provided, it's a case persona. Otherwise, global.
    const targetCaseId = caseId || SHARED_CASE_ID;

    const result = await getOrGeneratePersonaPortrait({
      supabase,
      openai,
      caseId: targetCaseId,
      stageRole: roleKey,
    });

    return NextResponse.json({ 
      imageUrl: result.imageUrl,
      message: "Portrait generated successfully" 
    });

  } catch (error) {
    console.error("Error generating portrait:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate portrait" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { loadPromptRecords, upsertPromptOverride } from "@/features/prompts/services/promptService";
import { findPromptDefinition } from "@/features/prompts/registry";
import { requireAdmin } from "@/app/api/_lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { supabase } = auth;
    const caseId = request.nextUrl.searchParams.get("caseId");
    const prompts = await loadPromptRecords(supabase, { caseId });
    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("Failed to load prompts", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { supabase } = auth;
    const body = (await request.json()) as {
      id?: string;
      value?: string;
      actor?: string | null;
    };

    if (!body?.id || typeof body.id !== "string") {
      return NextResponse.json(
        { error: "Prompt id is required" },
        { status: 400 }
      );
    }

    const definition = findPromptDefinition(body.id);
    if (!definition) {
      return NextResponse.json(
        { error: `Unknown prompt id: ${body.id}` },
        { status: 404 }
      );
    }

    const value = typeof body.value === "string" ? body.value : "";
    await upsertPromptOverride(supabase, body.id, value, body.actor ?? null);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("Failed to update prompt", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

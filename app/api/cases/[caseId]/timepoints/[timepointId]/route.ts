import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string; timepointId: string }> }
) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, adminSupabase } = auth;
  const { timepointId } = await params;

  try {
    const body = await req.json();
    const db = adminSupabase || supabase;

    const updatePayload: Record<string, unknown> = {
      sequence_index: body.sequence_index,
      label: body.label,
      summary: body.summary,
      available_after_hours: body.available_after_hours,
      after_stage_id: body.after_stage_id,
      persona_role_key: body.persona_role_key,
      stage_prompt: body.stage_prompt,
      updated_at: new Date().toISOString(),
    };

    // Sync legacy column if key is provided
    if (body.persona_role_key !== undefined) {
      updatePayload.persona_role = body.persona_role_key;
    }

    const { data, error } = await db
      .from("case_timepoints")
      .update(updatePayload)
      .eq("id", timepointId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ caseId: string; timepointId: string }> }
) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, adminSupabase } = auth;
  const { timepointId } = await params;
  const db = adminSupabase || supabase;

  const { error } = await db
    .from("case_timepoints")
    .delete()
    .eq("id", timepointId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

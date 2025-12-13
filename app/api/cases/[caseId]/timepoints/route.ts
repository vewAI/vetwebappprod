import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const { caseId } = await params;

  const { data, error } = await supabase
    .from("case_timepoints")
    .select("*")
    .eq("case_id", caseId)
    .order("sequence_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const { caseId } = await params;
  
  try {
    const body = await req.json();
    
    // Basic validation
    if (!body.label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("case_timepoints")
      .insert({
        case_id: caseId,
        sequence_index: body.sequence_index || 0,
        label: body.label,
        summary: body.summary,
        available_after_hours: body.available_after_hours,
        after_stage_id: body.after_stage_id,
        persona_role_key: body.persona_role_key,
        stage_prompt: body.stage_prompt
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

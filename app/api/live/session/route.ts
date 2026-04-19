import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase, user } = auth;

  try {
    const body = await req.json();
    const caseId = body?.caseId;

    if (!caseId) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }

    // Check for existing in-progress attempt
    const { data: existing, error: existingErr } = await supabase
      .from("attempts")
      .select("id, last_stage_index")
      .eq("case_id", caseId)
      .eq("user_id", user.id)
      .eq("completion_status", "in_progress")
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({
        attemptId: existing.id,
        currentStageIndex: existing.last_stage_index ?? 0,
        resumed: true,
      });
    }

    // Create new attempt
    const title = `Live — ${new Date().toISOString()}`;
    const { data: attempt, error: attemptErr } = await supabase
      .from("attempts")
      .insert({
        case_id: caseId,
        user_id: user.id,
        title,
        last_stage_index: 0,
        completion_status: "in_progress",
        time_spent_seconds: 0,
      })
      .select("id")
      .single();

    if (attemptErr) {
      return NextResponse.json(
        { error: attemptErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      attemptId: attempt.id,
      currentStageIndex: 0,
      resumed: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  try {
    const body = await req.json();
    const attemptId = body?.attemptId;
    const currentStageIndex = body?.currentStageIndex;
    const status = body?.status;

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof currentStageIndex === "number") {
      updates.last_stage_index = currentStageIndex;
    }
    if (status) {
      updates.completion_status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("attempts")
      .update(updates)
      .eq("id", attemptId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

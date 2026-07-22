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

    // P1.6: Check for an existing in-progress attempt to resume
    const { data: existing } = await supabase
      .from("attempts")
      .select("id, last_stage_index, messages, time_spent_seconds")
      .eq("case_id", caseId)
      .eq("user_id", user.id)
      .eq("completion_status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Resume the existing attempt with its stored messages and progress
      return NextResponse.json({
        attemptId: existing.id,
        currentStageIndex: existing.last_stage_index ?? 0,
        resumed: true,
        messages: existing.messages ?? [],
        timeSpentSeconds: existing.time_spent_seconds ?? 0,
      });
    }

    // Close any previous abandoned attempts for this case+user (not in_progress)
    await supabase
      .from("attempts")
      .update({ completion_status: "abandoned" })
      .eq("case_id", caseId)
      .eq("user_id", user.id)
      .neq("completion_status", "in_progress");

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
      messages: [],
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
    const messages = body?.messages;

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
    // P1.4+P1.6: Persist messages to attempts.messages jsonb
    if (Array.isArray(messages) && messages.length > 0) {
      updates.messages = messages;
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

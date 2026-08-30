import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";

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

    // F4.2: Prefer the atomic RPC (select+insert serialized via FOR UPDATE)
    // so concurrent tabs resume the same attempt instead of duplicating it.
    // Falls back to the legacy non-atomic flow when the migration hasn't
    // been applied yet.
    let claimed: {
      attempt_id: string;
      last_stage_index: number | null;
      time_spent_seconds: number | null;
      resumed: boolean;
    } | null = null;
    try {
      const { data, error: rpcError } = await (supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc("claim_live_attempt", { p_case_id: caseId, p_user_id: user.id });

      if (!rpcError && Array.isArray(data) && data.length > 0) {
        const row = data[0] as {
          attempt_id?: string;
          last_stage_index?: number | null;
          time_spent_seconds?: number | null;
          resumed?: boolean;
        };
        if (row?.attempt_id) {
          claimed = {
            attempt_id: row.attempt_id,
            last_stage_index: row.last_stage_index ?? null,
            time_spent_seconds: row.time_spent_seconds ?? null,
            resumed: row.resumed ?? true,
          };
        }
      } else if (rpcError) {
        console.warn("claim_live_attempt unavailable, using legacy flow:", rpcError.message);
      }
    } catch (rpcErr) {
      console.warn("claim_live_attempt threw, using legacy flow:", rpcErr);
    }

    if (claimed?.attempt_id) {
      const { data: storedMessages } = await supabase
        .from("attempt_messages")
        .select("id, role, content, timestamp, stage_index, display_role, persona_role_key")
        .eq("attempt_id", claimed.attempt_id)
        .order("timestamp", { ascending: true })
        .limit(1000);

      return NextResponse.json({
        attemptId: claimed.attempt_id,
        currentStageIndex: claimed.last_stage_index ?? 0,
        resumed: claimed.resumed,
        timeSpentSeconds: claimed.time_spent_seconds ?? 0,
        messages: (storedMessages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          stageIndex: message.stage_index,
          displayRole: message.display_role ?? undefined,
          personaRoleKey:
            typeof (message as { persona_role_key?: string | null }).persona_role_key === "string"
              ? (message as { persona_role_key?: string | null }).persona_role_key!
              : undefined,
          status: "sent",
        })),
      });
    }

    // Resume the latest in-progress attempt for this case instead of losing
    // the student's persisted transcript when the Live page is reopened.
    const { data: existingAttempt } = await supabase
      .from("attempts")
      .select("id, last_stage_index, time_spent_seconds")
      .eq("case_id", caseId)
      .eq("user_id", user.id)
      .eq("completion_status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAttempt) {
      const { data: storedMessages } = await supabase
        .from("attempt_messages")
        .select("id, role, content, timestamp, stage_index, display_role, persona_role_key")
        .eq("attempt_id", existingAttempt.id)
        .order("timestamp", { ascending: true })
        .limit(1000);

      return NextResponse.json({
        attemptId: existingAttempt.id,
        currentStageIndex: existingAttempt.last_stage_index ?? 0,
        resumed: true,
        timeSpentSeconds: existingAttempt.time_spent_seconds ?? 0,
        messages: (storedMessages ?? []).map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          stageIndex: message.stage_index,
          displayRole: message.display_role ?? undefined,
          personaRoleKey:
            typeof (message as { persona_role_key?: string | null }).persona_role_key === "string"
              ? (message as { persona_role_key?: string | null }).persona_role_key!
              : undefined,
          status: "sent",
        })),
      });
    }

    // Create a new attempt when no in-progress attempt exists.
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
  const { supabase, user } = auth;

  try {
    const body = await req.json();
    const attemptId = body?.attemptId;
    const currentStageIndex = body?.currentStageIndex;
    const status = body?.status;

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const access = await authorizeAttemptAccess(
      auth.adminSupabase ?? supabase,
      attemptId,
      auth.user.id,
      auth.role,
    );
    if (access.error) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }
    if (access.notFound) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      .eq("id", attemptId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

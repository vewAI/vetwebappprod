import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { accessCodesMatch, fetchCaseSessionRow, mapRowToCaseSession } from "@/app/api/_lib/caseSessions";
import { deriveStatus } from "@/features/case-sessions/models/caseSession";
import type { SessionAttemptRow } from "@/features/case-sessions/models/caseSession";
import { transformAttempt } from "@/features/attempts/mappers/attempt-mappers";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await context.params;
  const supabase = auth.adminSupabase ?? auth.supabase;

  const { data: row, error: loadErr } = await fetchCaseSessionRow(supabase, sessionId);
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = mapRowToCaseSession(row);
  if (deriveStatus(session) !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const accessCode = typeof body?.accessCode === "string" ? body.accessCode : undefined;

  if (!accessCodesMatch(row.access_code, accessCode)) {
    return NextResponse.json({ error: "Invalid or missing access code" }, { status: 403 });
  }

  const limit = row.attempt_limit_per_student;
  if (limit != null && limit > 0) {
    const { count, error: countErr } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("user_id", auth.user.id);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((count ?? 0) >= limit) {
      return NextResponse.json({ error: "Attempt limit reached for this session" }, { status: 403 });
    }
  }

  const title = `Attempt - ${new Date().toISOString()}`;

  const { data: inserted, error: insertErr } = await supabase
    .from("attempts")
    .insert({
      user_id: auth.user.id,
      case_id: row.case_id,
      title,
      last_stage_index: 0,
      completion_status: "in_progress",
      time_spent_seconds: 0,
      session_id: sessionId,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("POST session attempt insert", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ attempt: transformAttempt(inserted) });
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await context.params;
  const supabase = auth.adminSupabase ?? auth.supabase;

  const { data: row, error: loadErr } = await fetchCaseSessionRow(supabase, sessionId);
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCreatorOrAdmin =
    auth.role === "admin" || row.created_by === auth.user.id;

  let query = supabase
    .from("attempts")
    .select(
      isCreatorOrAdmin
        ? "id, user_id, case_id, session_id, completion_status, created_at, completed_at, time_spent_seconds, profiles!attempts_profiles_user_id_fkey(full_name, email)"
        : "id, user_id, case_id, session_id, completion_status, created_at, completed_at, time_spent_seconds"
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (!isCreatorOrAdmin) {
    query = query.eq("user_id", auth.user.id);
  }

  const { data: attempts, error } = await query;

  if (error) {
    console.error("GET session attempts", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type AttemptJoinRow = {
    id: string;
    user_id: string;
    case_id: string;
    session_id: string | null;
    completion_status: string | null;
    created_at: string;
    completed_at: string | null;
    time_spent_seconds: number | null;
    profiles?: { full_name?: string | null; email?: string | null } | null;
  };

  const mapped: SessionAttemptRow[] = (attempts ?? []).map((a: AttemptJoinRow) => {
    const prof = a.profiles;
    const cs = String(a.completion_status ?? "in_progress");
    const completionStatus = cs === "completed" ? ("completed" as const) : cs === "abandoned" ? ("abandoned" as const) : ("in_progress" as const);
    return {
      id: a.id,
      userId: a.user_id,
      caseId: a.case_id,
      sessionId: a.session_id ?? null,
      completionStatus,
      createdAt: a.created_at,
      completedAt: a.completed_at ?? undefined,
      timeSpentSeconds: Number(a.time_spent_seconds ?? 0),
      studentName: prof?.full_name ?? undefined,
      studentEmail: prof?.email ?? undefined,
    };
  });

  return NextResponse.json({ attempts: mapped });
}

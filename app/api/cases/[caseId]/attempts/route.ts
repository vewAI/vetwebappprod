import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { transformAttemptSummary } from "@/features/attempts/mappers/attempt-mappers";
import type { AttemptSummary } from "@/features/attempts/models/attempt";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { caseId } = await context.params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const supabase = auth.adminSupabase ?? auth.supabase;
  const ATTEMPT_COLUMNS =
    "id, user_id, case_id, session_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, cases (title, category, difficulty, image_url), profiles!attempts_profiles_user_id_fkey (full_name, email)";
  let { data, error } = await supabase
    .from("attempts")
    .select(`${ATTEMPT_COLUMNS}, case_sessions (id, friendly_name, year_group_id, year_groups(id, name))`)
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    const retry = await supabase
      .from("attempts")
      .select(`${ATTEMPT_COLUMNS}, case_sessions (id, friendly_name, year_group_id)`)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    data = retry.data as any;
    error = retry.error;
  }

  if (error) {
    console.error("GET /api/cases/[caseId]/attempts", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const yearGroupIds = [
    ...new Set(
      rows
        .map((row) => {
          const session = Array.isArray(row.case_sessions) ? row.case_sessions[0] : row.case_sessions;
          return typeof session?.year_group_id === "string" ? session.year_group_id : null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (yearGroupIds.length > 0) {
    const { data: yearGroups } = await supabase.from("year_groups").select("id, name").in("id", yearGroupIds);
    const nameById = new Map((yearGroups ?? []).map((group) => [group.id as string, group.name as string]));
    for (const row of rows) {
      const session = Array.isArray(row.case_sessions) ? row.case_sessions[0] : row.case_sessions;
      if (!session || session.year_groups) continue;
      const name = typeof session.year_group_id === "string" ? nameById.get(session.year_group_id) : undefined;
      if (name) (session as any).year_groups = [{ id: session.year_group_id, name }];
    }
  }

  const attempts: AttemptSummary[] = rows.map(transformAttemptSummary);
  return NextResponse.json({ attempts });
}

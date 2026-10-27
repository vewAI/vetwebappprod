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
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, user_id, case_id, session_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, cases (title, category, difficulty, image_url), case_sessions (id, friendly_name), profiles!attempts_profiles_user_id_fkey (full_name, email)"
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("GET /api/cases/[caseId]/attempts", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const attempts: AttemptSummary[] = (data ?? []).map(transformAttemptSummary);
  return NextResponse.json({ attempts });
}

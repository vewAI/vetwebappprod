import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { transformAttemptSummary } from "@/features/attempts/mappers/attempt-mappers";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import type { ProfessorStudentDetail } from "@/features/professor/models/student";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: studentId } = await context.params;
  if (!studentId) {
    return NextResponse.json({ error: "Missing student id" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient() ?? auth.adminSupabase ?? auth.supabase;

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("user_id, email, created_at, year_group_id, role, institution_id, year_groups!year_group_id(id, name)")
    .eq("user_id", studentId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile || (profile.role && profile.role !== "student")) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (auth.role !== "admin") {
    const { data: professorProfile } = await adminClient.from("profiles").select("institution_id").eq("user_id", auth.user.id).maybeSingle();
    if (!professorProfile?.institution_id || professorProfile.institution_id !== profile.institution_id) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
  }

  const yearGroupsJoin = (profile as { year_groups?: { id?: string; name?: string } | { id?: string; name?: string }[] | null }).year_groups;
  const yearGroup = Array.isArray(yearGroupsJoin) ? yearGroupsJoin[0] : yearGroupsJoin;
  let yearGroupName = typeof yearGroup?.name === "string" ? yearGroup.name : null;
  if (!yearGroupName && typeof profile.year_group_id === "string") {
    const { data: yearGroupRow } = await adminClient.from("year_groups").select("name").eq("id", profile.year_group_id).maybeSingle();
    yearGroupName = yearGroupRow?.name ?? null;
  }

  let lastSignInAt: string | null = null;
  try {
    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(studentId);
    if (!authError) lastSignInAt = authUser.user?.last_sign_in_at ?? null;
  } catch (err) {
    console.error("GET /api/professor/students/[id] last_sign_in", err);
  }

  const ATTEMPT_COLUMNS =
    "id, user_id, case_id, session_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, cases (title, category, difficulty, image_url)";
  let { data: attemptRows, error: attemptError } = await adminClient
    .from("attempts")
    .select(`${ATTEMPT_COLUMNS}, case_sessions (id, friendly_name, year_group_id, year_groups(id, name))`)
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  if (attemptError) {
    const retry = await adminClient
      .from("attempts")
      .select(`${ATTEMPT_COLUMNS}, case_sessions (id, friendly_name, year_group_id)`)
      .eq("user_id", studentId)
      .order("created_at", { ascending: false });
    attemptRows = retry.data as typeof attemptRows;
    attemptError = retry.error;
  }
  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  const attempts: AttemptSummary[] = (attemptRows ?? []).map(transformAttemptSummary);
  const missingYearGroupIds = [
    ...new Set(
      attempts.map((attempt) => (!attempt.sessionYearGroupName ? attempt.sessionYearGroupId : null)).filter((id): id is string => Boolean(id)),
    ),
  ];
  if (missingYearGroupIds.length > 0) {
    const { data: yearGroups } = await adminClient.from("year_groups").select("id, name").in("id", missingYearGroupIds);
    const nameById = new Map((yearGroups ?? []).map((group) => [String(group.id), String(group.name)]));
    for (const attempt of attempts) {
      if (attempt.sessionYearGroupName || !attempt.sessionYearGroupId) continue;
      attempt.sessionYearGroupName = nameById.get(attempt.sessionYearGroupId) ?? null;
    }
  }

  const student: ProfessorStudentDetail = {
    userId: String(profile.user_id),
    email: typeof profile.email === "string" ? profile.email : "",
    yearGroupId: typeof profile.year_group_id === "string" ? profile.year_group_id : null,
    yearGroupName,
    createdAt: typeof profile.created_at === "string" ? profile.created_at : "",
    lastSignInAt,
    attempts,
  };

  return NextResponse.json(student);
}

import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AttemptDayCount } from "@/features/professor/models/dashboard";

function lastThirtyDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getSupabaseAdminClient() ?? auth.adminSupabase ?? auth.supabase;
  const professorId = auth.user.id;
  const nowIso = new Date().toISOString();
  const fromIso = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();

  const [studentsRes, casesRes, sessionsRes] = await Promise.all([
    db.from("profiles").select("user_id", { count: "exact", head: true }).or("role.eq.student,role.is.null"),
    db.from("cases").select("id", { count: "exact", head: true }).eq("is_published", true),
    db
      .from("case_sessions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", professorId)
      .lte("start_at", nowIso)
      .gt("end_at", nowIso),
  ]);

  if (studentsRes.error) {
    return NextResponse.json({ error: studentsRes.error.message }, { status: 500 });
  }
  if (casesRes.error) {
    return NextResponse.json({ error: casesRes.error.message }, { status: 500 });
  }
  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  }

  const { data: enrollments, error: enrollErr } = await db
    .from("professor_students")
    .select("student_id")
    .eq("professor_id", professorId);
  if (enrollErr) {
    return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  }

  const studentIds = (enrollments ?? []).map((row) => row.student_id as string);
  const counts = new Map<string, number>();
  for (const day of lastThirtyDays()) counts.set(day, 0);

  if (studentIds.length > 0) {
    const { data: attempts, error: attemptsErr } = await db
      .from("attempts")
      .select("created_at")
      .in("user_id", studentIds)
      .gte("created_at", fromIso);
    if (attemptsErr) {
      return NextResponse.json({ error: attemptsErr.message }, { status: 500 });
    }
    for (const attempt of attempts ?? []) {
      const day = String(attempt.created_at).slice(0, 10);
      if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  const attemptsByDay: AttemptDayCount[] = lastThirtyDays().map((date) => ({
    date,
    attempts: counts.get(date) ?? 0,
  }));

  return NextResponse.json({
    studentCount: studentsRes.count ?? 0,
    caseCount: casesRes.count ?? 0,
    activeSessionCount: sessionsRes.count ?? 0,
    attemptsByDay,
  });
}

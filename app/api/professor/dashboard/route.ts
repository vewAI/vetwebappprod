import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AttemptDayCount, RankedCount } from "@/features/professor/models/dashboard";

function lastThirtyDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function topCounts(counts: Map<string, number>, limit = 5): { id: string; count: number }[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
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

  const [studentsRes, casesRes, sessionsRes, attemptsRes, mySessionsRes, studentYearRes] = await Promise.all([
    db.from("profiles").select("user_id", { count: "exact", head: true }).or("role.eq.student,role.is.null"),
    db.from("cases").select("id", { count: "exact", head: true }).eq("is_published", true),
    db
      .from("case_sessions")
      .select("id", { count: "exact", head: true })
      .eq("created_by", professorId)
      .lte("start_at", nowIso)
      .gt("end_at", nowIso),
    db.from("attempts").select("created_at, case_id, session_id").gte("created_at", fromIso).limit(10000),
    db
      .from("case_sessions")
      .select("id, friendly_name, created_at")
      .eq("created_by", professorId)
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("profiles").select("year_group_id").or("role.eq.student,role.is.null").limit(10000),
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
  if (attemptsRes.error) {
    return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
  }
  if (mySessionsRes.error) {
    return NextResponse.json({ error: mySessionsRes.error.message }, { status: 500 });
  }
  if (studentYearRes.error) {
    return NextResponse.json({ error: studentYearRes.error.message }, { status: 500 });
  }

  const counts = new Map<string, number>();
  for (const day of lastThirtyDays()) counts.set(day, 0);

  const caseAttemptCounts = new Map<string, number>();
  const latestSessions = mySessionsRes.data ?? [];
  const latestSessionIds = new Set(latestSessions.map((session) => session.id as string));
  const sessionAttemptCounts = new Map<string, number>();

  for (const attempt of attemptsRes.data ?? []) {
    const day = String(attempt.created_at).slice(0, 10);
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    if (typeof attempt.case_id === "string" && attempt.case_id) {
      caseAttemptCounts.set(attempt.case_id, (caseAttemptCounts.get(attempt.case_id) ?? 0) + 1);
    }
    if (typeof attempt.session_id === "string" && latestSessionIds.has(attempt.session_id)) {
      sessionAttemptCounts.set(attempt.session_id, (sessionAttemptCounts.get(attempt.session_id) ?? 0) + 1);
    }
  }

  const attemptsByDay: AttemptDayCount[] = lastThirtyDays().map((date) => ({
    date,
    attempts: counts.get(date) ?? 0,
  }));

  const topCaseRanks = topCounts(caseAttemptCounts);
  const caseTitleById = new Map<string, string>();
  if (topCaseRanks.length > 0) {
    const { data: caseRows, error: caseErr } = await db
      .from("cases")
      .select("id, title")
      .in(
        "id",
        topCaseRanks.map((row) => row.id),
      );
    if (caseErr) {
      return NextResponse.json({ error: caseErr.message }, { status: 500 });
    }
    for (const row of caseRows ?? []) {
      caseTitleById.set(row.id as string, (row.title as string) || "Case");
    }
  }

  const topCases: RankedCount[] = topCaseRanks.map((row) => ({
    id: row.id,
    name: caseTitleById.get(row.id) ?? "Case",
    count: row.count,
  }));

  const topSessions: RankedCount[] = latestSessions.map((session) => ({
    id: session.id as string,
    name: (session.friendly_name as string) || "Session",
    count: sessionAttemptCounts.get(session.id as string) ?? 0,
  }));

  const yearCounts = new Map<string, number>();
  for (const row of studentYearRes.data ?? []) {
    const key = typeof row.year_group_id === "string" && row.year_group_id ? row.year_group_id : "none";
    yearCounts.set(key, (yearCounts.get(key) ?? 0) + 1);
  }

  const yearGroupIds = [...yearCounts.keys()].filter((id) => id !== "none");
  const yearNameById = new Map<string, string>();
  type YearGroupRow = {
    id: string;
    name: string;
    institution_id?: string;
    institutions?: { name: string } | { name: string }[] | null;
  };

  if (yearGroupIds.length > 0) {
    let yearRows: YearGroupRow[] | null = null;
    const withInstitution = await db
      .from("year_groups")
      .select("id, name, institution_id, institutions!institution_id(name)")
      .in("id", yearGroupIds);
    if (withInstitution.error) {
      const retry = await db.from("year_groups").select("id, name").in("id", yearGroupIds);
      if (retry.error) {
        return NextResponse.json({ error: retry.error.message }, { status: 500 });
      }
      yearRows = (retry.data as unknown) as YearGroupRow[];
    } else {
      yearRows = (withInstitution.data as unknown) as YearGroupRow[];
    }
    const institutionNames = new Set(
      (yearRows ?? []).map((group) => {
        const inst = Array.isArray(group.institutions) ? group.institutions[0] : group.institutions;
        return inst?.name ?? "";
      }),
    );
    const showInstitution = [...institutionNames].filter(Boolean).length > 1;
    for (const group of yearRows ?? []) {
      const inst = Array.isArray(group.institutions) ? group.institutions[0] : group.institutions;
      const name =
        showInstitution && inst?.name ? `${inst.name} — ${group.name}` : group.name;
      yearNameById.set(group.id, name);
    }
  }

  const studentsByYearGroup: RankedCount[] = [...yearCounts.entries()]
    .map(([id, count]) => ({
      id,
      name: id === "none" ? "Unassigned" : (yearNameById.get(id) ?? "Year group"),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({
    studentCount: studentsRes.count ?? 0,
    caseCount: casesRes.count ?? 0,
    activeSessionCount: sessionsRes.count ?? 0,
    attemptsByDay,
    topCases,
    topSessions,
    studentsByYearGroup,
  });
}

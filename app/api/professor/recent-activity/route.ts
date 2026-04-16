import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { adminSupabase, user } = auth;
  if (!adminSupabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 1. Get professor's student IDs
  const { data: relations } = await adminSupabase
    .from("professor_students")
    .select("student_id")
    .eq("professor_id", user.id);

  const studentIds = (relations ?? []).map((r: { student_id: string }) => r.student_id);

  // 2. Recent completed attempts
  let completions: Record<string, unknown>[] = [];
  if (studentIds.length > 0) {
    const { data } = await adminSupabase
      .from("attempts")
      .select("id, user_id, case_id, created_at, cases(title), profiles!attempts_user_id_fkey(full_name)")
      .in("user_id", studentIds)
      .eq("completion_status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);
    completions = (data ?? []) as Record<string, unknown>[];
  }

  // 3. Recent enrollments
  const { data: enrollments } = await adminSupabase
    .from("professor_students")
    .select("student_id, created_at, profiles!professor_students_student_id_fkey(full_name)")
    .eq("professor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    completions: completions.map((a) => {
      const c = a.cases as Record<string, unknown> | undefined;
      const p = a.profiles as Record<string, unknown> | undefined;
      return {
        attemptId: a.id,
        studentId: a.user_id,
        studentName: (p?.full_name as string) ?? "Unknown",
        caseTitle: (c?.title as string) ?? "Unknown Case",
        date: a.created_at,
      };
    }),
    enrollments: ((enrollments ?? []) as Record<string, unknown>[]).map((e) => {
      const p = e.profiles as Record<string, unknown> | undefined;
      return {
        studentId: e.student_id,
        studentName: (p?.full_name as string) ?? "Unknown",
        date: e.created_at,
      };
    }),
  });
}

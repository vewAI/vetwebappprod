import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const { adminSupabase, supabase } = auth;
  const db = adminSupabase ?? supabase;

  // Verify course ownership
  const { data: course } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.professor_id !== auth.user.id) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // 1. Get all students in the course
  const { data: enrollments, error: enrollErr } = await db
    .from("course_students")
    .select("student_id, profiles!course_students_student_id_fkey(user_id, full_name, email)")
    .eq("course_id", courseId);
  if (enrollErr) {
    return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  }

  const students = (enrollments ?? []).map((e: Record<string, unknown>) => {
    const p = e.profiles as Record<string, unknown> | undefined;
    return {
      studentId: e.student_id as string,
      fullName: (p?.full_name as string) ?? "Unknown",
      email: (p?.email as string) ?? "",
    };
  });

  const studentIds = students.map((s) => s.studentId);

  if (studentIds.length === 0) {
    return NextResponse.json({
      totalStudents: 0,
      studentsWithCompletedAttempt: 0,
      totalAttempts: 0,
      completedAttempts: 0,
      completionRate: 0,
      avgTimeSeconds: 0,
      perStudent: [],
      perCase: [],
    });
  }

  // 2. Get assigned cases
  const { data: courseCases } = await db
    .from("course_case_assignments")
    .select("case_id, cases(id, title)")
    .eq("course_id", courseId);

  // 3. Get all attempts for these students
  const { data: attempts, error: attemptsErr } = await db
    .from("attempts")
    .select("user_id, case_id, completion_status, time_spent_seconds, created_at")
    .in("user_id", studentIds);
  if (attemptsErr) {
    return NextResponse.json({ error: attemptsErr.message }, { status: 500 });
  }

  const allAttempts = attempts ?? [];
  const completed = allAttempts.filter(
    (a) => a.completion_status === "completed"
  );

  // Per-student stats
  const perStudent = students.map((s) => {
    const sa = allAttempts.filter((a) => a.user_id === s.studentId);
    const sc = sa.filter((a) => a.completion_status === "completed");
    const totalTime = sc.reduce(
      (sum, a) => sum + (a.time_spent_seconds ?? 0),
      0
    );
    const lastActivity =
      sa.length > 0
        ? sa.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )[0].created_at
        : null;

    return {
      ...s,
      completedAttempts: sc.length,
      totalAttempts: sa.length,
      avgTimeSeconds:
        sc.length > 0 ? Math.round(totalTime / sc.length) : 0,
      lastActivityAt: lastActivity,
    };
  });

  // Per-case stats
  const perCase = (courseCases ?? []).map((cc: Record<string, unknown>) => {
    const caseData = cc.cases as Record<string, unknown> | undefined;
    const caseId = cc.case_id as string;
    const caseCompleted = completed.filter((a) => a.case_id === caseId);
    const uniqueCompleted = new Set(caseCompleted.map((a) => a.user_id)).size;

    return {
      caseId,
      caseTitle: (caseData?.title as string) ?? caseId,
      studentsCompleted: uniqueCompleted,
      studentsAssigned: studentIds.length,
    };
  });

  const totalTimeAll = completed.reduce(
    (sum, a) => sum + (a.time_spent_seconds ?? 0),
    0
  );
  const studentsWithCompleted = new Set(
    completed.map((a) => a.user_id)
  ).size;

  return NextResponse.json({
    totalStudents: studentIds.length,
    studentsWithCompletedAttempt: studentsWithCompleted,
    totalAttempts: allAttempts.length,
    completedAttempts: completed.length,
    completionRate:
      studentIds.length > 0
        ? Math.round((studentsWithCompleted / studentIds.length) * 100)
        : 0,
    avgTimeSeconds:
      completed.length > 0 ? Math.round(totalTimeAll / completed.length) : 0,
    perStudent,
    perCase,
  });
}

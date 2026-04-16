import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const { caseId } = await request.json();

  if (!caseId || typeof caseId !== "string") {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  const { supabase, adminSupabase } = auth;
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

  // Add to course_case_assignments (idempotent via UNIQUE constraint)
  const { error: assignErr } = await db
    .from("course_case_assignments")
    .upsert(
      {
        course_id: courseId,
        case_id: caseId,
        assigned_by: auth.user.id,
      },
      { onConflict: "course_id,case_id" }
    );
  if (assignErr) {
    return NextResponse.json({ error: assignErr.message }, { status: 500 });
  }

  // Get all students in the course
  const { data: enrollments } = await db
    .from("course_students")
    .select("student_id")
    .eq("course_id", courseId);

  const studentIds = (enrollments ?? []).map(
    (e: { student_id: string }) => e.student_id
  );

  // Assign case to each student individually (for existing attempt system)
  let assignedCount = 0;
  for (const sid of studentIds) {
    const { error: indErr } = await db
      .from("professor_assigned_cases")
      .upsert(
        {
          professor_id: auth.user.id,
          student_id: sid,
          case_id: caseId,
        },
        { onConflict: "professor_id,student_id,case_id" }
      );
    if (!indErr) assignedCount++;
  }

  return NextResponse.json({
    success: true,
    assignedTo: assignedCount,
    totalStudents: studentIds.length,
  });
}

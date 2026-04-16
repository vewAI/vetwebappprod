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
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("course_students")
    .select("*, profiles!course_students_student_id_fkey(user_id, full_name, email, avatar_url)")
    .eq("course_id", courseId)
    .order("added_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const students = (data ?? []).map((row: Record<string, unknown>) => {
    const p = row.profiles as Record<string, unknown> | undefined;
    return {
      id: row.id,
      courseId: row.course_id,
      studentId: row.student_id,
      addedAt: row.added_at,
      student: p
        ? {
            id: p.user_id ?? "",
            fullName: p.full_name ?? "Unknown",
            email: p.email ?? "",
            avatarUrl: p.avatar_url ?? undefined,
          }
        : undefined,
    };
  });

  return NextResponse.json(students);
}

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
  const { studentIds } = await request.json();

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json(
      { error: "studentIds array is required" },
      { status: 400 }
    );
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

  // Add students to course
  const rows = studentIds.map((sid: string) => ({
    course_id: courseId,
    student_id: sid,
  }));

  const { error: enrollErr } = await db
    .from("course_students")
    .insert(rows);
  if (enrollErr) {
    return NextResponse.json({ error: enrollErr.message }, { status: 500 });
  }

  // Also assign any existing course cases to the new students
  const { data: courseCases } = await db
    .from("course_case_assignments")
    .select("case_id")
    .eq("course_id", courseId);

  if (courseCases && courseCases.length > 0) {
    const individualAssignments = studentIds.flatMap((sid: string) =>
      courseCases.map((cc: { case_id: string }) => ({
        professor_id: auth.user.id,
        student_id: sid,
        case_id: cc.case_id,
      }))
    );

    // Use upsert-like approach: insert ignoring duplicates
    for (const assignment of individualAssignments) {
      await db.from("professor_assigned_cases").upsert(assignment, {
        onConflict: "professor_id,student_id,case_id",
      });
    }
  }

  return NextResponse.json({ success: true, added: studentIds.length });
}

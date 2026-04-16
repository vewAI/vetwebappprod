import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string; studentId: string }> }
) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId, studentId } = await params;
  const { supabase } = auth;

  // Verify course ownership
  const { data: course } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.professor_id !== auth.user.id) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("course_students")
    .delete()
    .eq("course_id", courseId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

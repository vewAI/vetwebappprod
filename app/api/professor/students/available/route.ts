import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

// Lists the professor's students who are NOT enrolled in ANY of the
// professor's courses — used by the batch "Add students" dialog.
// Optional ?courseId= is accepted for future per-course filtering.
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase, adminSupabase } = auth;
  const db = adminSupabase ?? supabase;

  // 1. The professor's students
  const { data: rel, error: relErr } = await supabase
    .from("professor_students")
    .select("student_id")
    .eq("professor_id", auth.user.id);
  if (relErr) {
    return NextResponse.json({ error: relErr.message }, { status: 500 });
  }
  const studentIds = (rel ?? []).map((r: Record<string, unknown>) => r.student_id as string);
  if (studentIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  // 2. Students already enrolled in ANY of this professor's courses
  const { data: myCourses } = await supabase
    .from("courses")
    .select("id")
    .eq("professor_id", auth.user.id);
  const courseIds = (myCourses ?? []).map((c: Record<string, unknown>) => c.id as string);

  const assigned = new Set<string>();
  if (courseIds.length > 0) {
    const { data: enrolled } = await db
      .from("course_students")
      .select("student_id")
      .in("course_id", courseIds);
    for (const row of enrolled ?? []) {
      assigned.add((row as Record<string, unknown>).student_id as string);
    }
  }

  const availableIds = studentIds.filter((id) => !assigned.has(id));
  if (availableIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  // 3. Identities
  const { data: profiles, error: profilesErr } = await db
    .from("profiles")
    .select("user_id, full_name, email, avatar_url")
    .in("user_id", availableIds)
    .order("full_name", { ascending: true });
  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  const students = (profiles ?? []).map((p: Record<string, unknown>) => ({
    id: p.user_id as string,
    fullName: (p.full_name as string) ?? "Unknown",
    email: (p.email as string) ?? "",
    avatarUrl: (p.avatar_url as string) ?? undefined,
  }));

  return NextResponse.json({ students });
}

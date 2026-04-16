import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNum = Math.ceil((diff / oneWeek + start.getDay() + 1) / 1);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function weekLabel(key: string): string {
  const [year, week] = key.split("-W");
  return `W${week} ${year}`;
}

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
  const { adminSupabase, user } = auth;
  if (!adminSupabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Verify course ownership
  const { data: course } = await adminSupabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.professor_id !== user.id) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Get enrolled student IDs
  const { data: enrollments } = await adminSupabase
    .from("course_students")
    .select("student_id")
    .eq("course_id", courseId);

  const studentIds = (enrollments ?? []).map((e: { student_id: string }) => e.student_id);
  if (studentIds.length === 0) {
    return NextResponse.json({ trends: [] });
  }

  // Get all attempts for these students
  const { data: attempts, error } = await adminSupabase
    .from("attempts")
    .select("created_at, completion_status")
    .in("user_id", studentIds)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by week
  const grouped = new Map<string, { completions: number; total: number }>();
  for (const a of attempts ?? []) {
    const key = getWeekKey(a.created_at);
    const group = grouped.get(key) ?? { completions: 0, total: 0 };
    group.total++;
    if (a.completion_status === "completed") group.completions++;
    grouped.set(key, group);
  }

  const trends = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      period: weekLabel(key),
      completions: val.completions,
      totalAttempts: val.total,
    }));

  return NextResponse.json({ trends });
}

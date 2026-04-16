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

  // 1. Get all student IDs for this professor
  const { data: relations, error: relError } = await adminSupabase
    .from("professor_students")
    .select("student_id")
    .eq("professor_id", user.id);

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  if (!relations || relations.length === 0) {
    return NextResponse.json({ count: 0, reviews: [] });
  }

  const studentIds = relations.map((r) => r.student_id);

  // 2. Find completed attempts with no professor feedback
  const { data: attempts, error: attemptsError } = await adminSupabase
    .from("attempts")
    .select("id, user_id, case_id, created_at, cases(title), profiles!attempts_user_id_fkey(full_name)")
    .in("user_id", studentIds)
    .eq("completion_status", "completed")
    .is("professor_feedback", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (attemptsError) {
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }

  const reviews = (attempts ?? []).map((a: Record<string, unknown>) => {
    const caseData = a.cases as Record<string, unknown> | undefined;
    const profile = a.profiles as Record<string, unknown> | undefined;
    return {
      attemptId: a.id as string,
      studentId: a.user_id as string,
      studentName: (profile?.full_name as string) ?? "Unknown",
      caseId: a.case_id as string,
      caseTitle: (caseData?.title as string) ?? "Unknown Case",
      completedAt: a.created_at as string,
    };
  });

  return NextResponse.json({ count: reviews.length, reviews });
}

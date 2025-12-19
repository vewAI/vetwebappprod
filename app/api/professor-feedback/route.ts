import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { adminSupabase, user, role } = auth;
  if (!adminSupabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  try {
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    // If professor wants to fetch a student's feedback, ensure professor role and return
    if (role === "professor") {
      if (!studentId) return NextResponse.json({ error: "studentId query param required" }, { status: 400 });
      const { data, error } = await adminSupabase
        .from("professor_feedback")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ feedback: data || [] });
    }

    // If student requests, ignore query and return their own feedback
    if (role === "student") {
      const { data, error } = await adminSupabase
        .from("professor_feedback")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ feedback: data || [] });
    }

    // Admin can optionally pass studentId
    if (role === "admin") {
      if (!studentId) return NextResponse.json({ error: "studentId required for admin" }, { status: 400 });
      const { data, error } = await adminSupabase
        .from("professor_feedback")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ feedback: data || [] });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { adminSupabase, user, role } = auth;
  if (!adminSupabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  try {
    const body = await req.json();
    const { professorId, studentId, message, metadata } = body;
    if (!professorId || !studentId || !message) {
      return NextResponse.json({ error: "professorId, studentId and message are required" }, { status: 400 });
    }

    // Allow professors to post for their students and students to post to their assigned professor
    if (role === "professor") {
      // ensure professor is posting as themselves
      if (professorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (role === "student") {
      // ensure studentId matches the logged in user
      if (studentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const payload: any = { professor_id: professorId, student_id: studentId, message, metadata: metadata ?? null };
    const { data, error } = await adminSupabase.from("professor_feedback").insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    return NextResponse.json({ success: true, feedback: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

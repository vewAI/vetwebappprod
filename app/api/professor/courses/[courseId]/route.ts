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
    .from("courses")
    .select("*, course_students(count)")
    .eq("id", courseId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (data.professor_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sc = data.course_students as { count: number }[] | undefined;
  return NextResponse.json({
    id: data.id,
    name: data.name,
    description: data.description ?? "",
    professorId: data.professor_id,
    studentCount: sc?.[0]?.count ?? 0,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { courseId } = await params;
  const { name, description, archived } = await request.json();
  const { supabase } = auth;

  // Verify ownership
  const { data: course, error: fetchErr } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .maybeSingle();
  if (fetchErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.professor_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, string | boolean> = {};
  if (typeof name === "string") updates.name = name.trim();
  if (typeof description === "string") updates.description = description.trim();
  if (typeof archived === "boolean") updates.archived = archived;

  const { data, error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
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

  // Verify ownership
  const { data: course } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.professor_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

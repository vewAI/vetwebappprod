import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = auth.adminSupabase ?? auth.supabase;

  // Query courses only, skip student counts to avoid RLS recursion policy bug
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, description, professor_id, created_at")
    .eq("professor_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/professor/courses — Supabase error:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message, hint: error.hint }, { status: 500 });
  }

  const courses = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    studentCount: 0, // TODO: Fix RLS policy to allow course_students queries
  }));

  return NextResponse.json(courses);
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }

  const supabase = auth.adminSupabase ?? auth.supabase;

  console.log(`[POST /api/professor/courses] Creating course for professor_id="${auth.user.id}" with name="${name}"`);

  const { data, error } = await supabase
    .from("courses")
    .insert({
      professor_id: auth.user.id,
      name: name.trim(),
      description: (description as string)?.trim() ?? "",
    })
    .select("id, name, description, professor_id, created_at")
    .single();

  if (error) {
    console.error(`[POST /api/professor/courses] Supabase error:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 });
  }

  console.log(`[POST /api/professor/courses] Course created successfully with id="${data?.id}"`);
  return NextResponse.json({ data });
}

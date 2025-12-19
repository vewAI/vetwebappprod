import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { professorId, studentId } = body;
  if (!professorId || !studentId) {
    return NextResponse.json({ error: "professorId and studentId required" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("professor_students")
    .insert({ professor_id: professorId, student_id: studentId })
    .select()
    .single();

  if (error) {
    // If unique violation, return 409
    if ((error as any)?.code === "23505") {
      return NextResponse.json({ error: "Assignment already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true, assignment: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const professorId = searchParams.get("professorId");
  const studentId = searchParams.get("studentId");

  if (!professorId || !studentId) {
    return NextResponse.json({ error: "professorId and studentId query params required" }, { status: 400 });
  }

  const { error } = await adminClient
    .from("professor_students")
    .delete()
    .match({ professor_id: professorId, student_id: studentId });

  if (error) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Optional professorId or studentId filter
  const { searchParams } = new URL(request.url);
  const professorId = searchParams.get("professorId");
  const studentId = searchParams.get("studentId");

  let query = adminClient
    .from("professor_students")
    .select("*, student:profiles(*), professor:profiles(*)");

  if (professorId) query = query.eq("professor_id", professorId);
  if (studentId) query = query.eq("student_id", studentId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }

  return NextResponse.json({ assignments: data || [] });
}

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireUser(request as Request);
  if ("error" in auth) return auth.error;

  const { adminSupabase, user, role, supabase: userSupabase } = auth;
  const { attemptId } = await context.params;
  if (!attemptId) return NextResponse.json({ error: "attemptId required" }, { status: 400 });

  try {
    // Load attempt using admin client so we can return professorFeedback if allowed
    const adminClient = adminSupabase ?? getSupabaseAdminClient();
    if (!adminClient) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    const { data: attemptRow, error: attemptErr } = await adminClient.from("attempts").select("*").eq("id", attemptId).maybeSingle();
    if (attemptErr || !attemptRow) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    // Permission: owner (attempt.user_id), admin, or assigned professor may view
    const isOwner = attemptRow.user_id === user.id;
    if (!isOwner && role !== "admin") {
      if (role === "professor") {
        // verify professor->student assignment
        const { data: rel } = await adminClient
          .from("professor_students")
          .select("*")
          .eq("professor_id", user.id)
          .eq("student_id", attemptRow.user_id)
          .limit(1)
          .maybeSingle();
        if (!rel) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch messages and feedback using adminSupabase for completeness
    const { data: messages } = await adminClient.from("attempt_messages").select("*").eq("attempt_id", attemptId).order("timestamp", { ascending: true });
    const { data: feedback } = await adminClient.from("attempt_feedback").select("*").eq("attempt_id", attemptId).order("stage_index", { ascending: true });

    // Return attempt (including professor_feedback) and related arrays
    return NextResponse.json({ attempt: attemptRow, messages: messages || [], feedback: feedback || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

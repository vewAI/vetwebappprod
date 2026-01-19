import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  transformAttempt,
  transformFeedback,
  transformMessage,
} from "@/features/attempts/mappers/attempt-mappers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await context.params;

  const auth = await requireUser(request as Request);
  if ("error" in auth) return auth.error;

  const { adminSupabase, user, role } = auth;

  if (!attemptId)
    return NextResponse.json({ error: "attemptId required" }, { status: 400 });

  try {
    // Load attempt using admin client so we can return professorFeedback if allowed
    const adminClient = adminSupabase ?? getSupabaseAdminClient();
    if (!adminClient)
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );

    const { data: attemptRow, error } = await adminClient
      .from("attempts")
      .select(`*, attempt_messages (*), attempt_feedback (*)`)
      .eq("id", attemptId)
      .maybeSingle();

    if (error || !attemptRow)
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

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
        if (!rel)
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Return attempt
    return NextResponse.json({
      attempt: transformAttempt(attemptRow),
      messages: attemptRow?.attempt_messages?.map(transformMessage),
      feedback: attemptRow?.attempt_feedback?.map(transformFeedback),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

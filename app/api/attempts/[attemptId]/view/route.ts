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

  const { adminSupabase } = auth;

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
      .select(
        `*, attempt_messages (*), attempt_feedback (*), cases (id, title)`
      )
      .eq("id", attemptId)
      .maybeSingle();

    if (error || !attemptRow)
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

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

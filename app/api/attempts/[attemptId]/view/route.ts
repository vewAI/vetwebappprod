import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";
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
    // Load attempt with the admin client only after an ownership or staff check.
    const adminClient = adminSupabase ?? getSupabaseAdminClient();
    if (!adminClient)
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );

    const access = await authorizeAttemptAccess(adminClient, attemptId, user.id, role, {
      allowProfessorRead: true,
    });
    if (access.error) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }
    if (access.notFound) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: attemptRow, error } = await adminClient
      .from("attempts")
      .select(
        `*, attempt_messages (*), attempt_feedback (*), cases (*)`
      )
      .eq("id", attemptId)
      .maybeSingle();

    if (error || !attemptRow)
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

    const caseRow = Array.isArray(attemptRow.cases) ? attemptRow.cases[0] : attemptRow.cases;
    const userId = typeof attemptRow.user_id === "string" ? attemptRow.user_id : null;
    let studentProfile = null;
    if (userId) {
      const profileSelect = "id, user_id, email, full_name, avatar_url, role";
      const { data: byUserId } = await adminClient
        .from("profiles")
        .select(profileSelect)
        .eq("user_id", userId)
        .maybeSingle();
      const studentRow =
        byUserId ??
        (
          await adminClient.from("profiles").select(profileSelect).eq("id", userId).maybeSingle()
        ).data;
      if (studentRow) {
        studentProfile = {
          id: studentRow.id,
          email: studentRow.email ?? null,
          fullName: studentRow.full_name ?? null,
          avatarUrl: studentRow.avatar_url ?? null,
          role: studentRow.role ?? null,
        };
      }
    }

    return NextResponse.json({
      attempt: transformAttempt(attemptRow),
      messages: attemptRow?.attempt_messages?.map(transformMessage) ?? [],
      feedback: attemptRow?.attempt_feedback?.map(transformFeedback) ?? [],
      case: caseRow ?? null,
      studentProfile,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

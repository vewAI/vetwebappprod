import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const { adminSupabase, user, role } = auth;
  if (role !== "admin" && role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!adminSupabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const attemptId = url.searchParams.get("attemptId");
    if (!attemptId) {
      return NextResponse.json({ error: "attemptId query param is required" }, { status: 400 });
    }

    const access = await authorizeAttemptAccess(adminSupabase, attemptId, user.id, role, {
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

    // Fetch the already-authorized attempt using the admin client so we can
    // include professor feedback and related records.
    const { data: attemptData, error: attemptError } = await adminSupabase
      .from("attempts")
      .select("*")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError || !attemptData) {
      return NextResponse.json({ error: attemptError?.message || "Attempt not found" }, { status: 404 });
    }

    // Fetch messages and feedback
    const { data: messages } = await adminSupabase
      .from("attempt_messages")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("timestamp", { ascending: true });

    const { data: feedback } = await adminSupabase
      .from("attempt_feedback")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("stage_index", { ascending: true });

    return NextResponse.json({ attempt: attemptData, messages: messages || [], feedback: feedback || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

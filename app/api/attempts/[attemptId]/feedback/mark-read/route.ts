import { NextResponse, NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const params = await context.params;
  const attemptId = params?.attemptId;
  if (!attemptId) {
    return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  }

  try {
    // Verify the current user owns the attempt
    const { data: attemptData, error: fetchErr } = await auth.supabase
      .from("attempts")
      .select("user_id")
      .eq("id", attemptId)
      .single();

    if (fetchErr || !attemptData) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attemptData.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: updateErr } = await auth.supabase
      .from("attempts")
      .update({ feedback_read_at: new Date().toISOString() })
      .eq("id", attemptId);

    if (updateErr) {
      console.error("Failed to mark feedback read:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

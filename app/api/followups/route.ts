import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const { attemptId, followupDay = 1, notes } = body as {
      attemptId?: string;
      followupDay?: number;
      notes?: string;
    };

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    // Fetch attempt to get case_id
    const { data: attemptData, error: attemptError } = await supabase
      .from("attempts")
      .select("id, case_id")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attemptData) {
      return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
    }

    const caseId = attemptData.case_id;

    const { data, error } = await supabase.from("followups").insert({
      attempt_id: attemptId,
      case_id: caseId,
      followup_day: Number(followupDay || 1),
      notes: notes ?? null,
      created_by: auth.user.id,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: "insert_failed", detail: String(error) }, { status: 500 });
    }
    return NextResponse.json({ success: true, followup: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "server_error", message }, { status: 500 });
  }
}

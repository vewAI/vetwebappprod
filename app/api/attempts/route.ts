import { NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";

// Delete an attempt by id (query param ?id=...)
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    // Delete dependent rows first (attempt_messages, attempt_feedback) to avoid FK issues
    const { error: msgErr } = await supabase
      .from("attempt_messages")
      .delete()
      .eq("attempt_id", id);
    if (msgErr) {
      // log but continue to attempt to delete attempt row
      console.error("Error deleting attempt_messages for attempt", id, msgErr);
    }
    const { error: fbErr } = await supabase
      .from("attempt_feedback")
      .delete()
      .eq("attempt_id", id);
    if (fbErr) {
      console.error("Error deleting attempt_feedback for attempt", id, fbErr);
    }

    const { error } = await supabase.from("attempts").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

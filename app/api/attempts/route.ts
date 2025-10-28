import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey
);

// Delete an attempt by id (query param ?id=...)
export async function DELETE(req: Request) {
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

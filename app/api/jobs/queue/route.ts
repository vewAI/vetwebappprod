import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const { adminSupabase } = auth;
  const { getSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const admin = adminSupabase ?? getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  try {
    const body = await req.json().catch(() => ({}));
    const { queueName, payload } = body as { queueName?: string; payload?: unknown };
    if (!queueName || !payload) {
      return NextResponse.json({ error: "queueName and payload required" }, { status: 400 });
    }

    const { error } = await admin.from("job_queue").insert([{ queue_name: queueName, payload }]);
    if (error) {
      console.error("Failed to enqueue job", error);
      return NextResponse.json({ error: error.message ?? "db_error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

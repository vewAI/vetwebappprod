import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const auth = await requireUser(request as Request);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { caseId } = await context.params;
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = typeof body.updates === "object" && body.updates ? body.updates : null;
  if (!updates) return NextResponse.json({ error: "updates object required" }, { status: 400 });

  try {
    console.log("[compare.apply] caseId=", caseId, "updates=", JSON.stringify(updates).slice(0, 2000));
    // Sanitize: do not allow changing primary key or guarded timestamp fields
    const sanitized: Record<string, unknown> = { ...updates } as Record<string, unknown>;
    delete (sanitized as any).id;
    delete (sanitized as any).created_at;
    delete (sanitized as any).updated_at;
    const { data, error } = await supabase.from("cases").update(sanitized).eq("id", caseId).select().maybeSingle();
    if (error) {
      console.error("[compare.apply] supabase error:", error);
      return NextResponse.json({ error: error.message ?? "DB update failed", details: (error as any).details ?? null }, { status: 500 });
    }
    console.log("[compare.apply] updated row", data ? true : false);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[compare.apply] exception:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

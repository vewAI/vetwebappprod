import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const { role, adminSupabase } = auth;
  if (!role || (role !== "professor" && role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!adminSupabase) {
    return NextResponse.json({ error: "admin_client_required", message: "Server missing SUPABASE_SERVICE_ROLE_KEY; cannot perform owner update." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { caseId, ownerId } = body as { caseId?: string; ownerId?: string };
    if (!caseId || !ownerId) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    // Only set owner when currently null to avoid clobbering an existing owner
    const { data, error } = await adminSupabase
      .from("cases")
      .update({ owner_id: ownerId })
      .eq("id", caseId)
      .is("owner_id", null)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Failed to set case owner", error);
      return NextResponse.json({ error: "db_update_failed", detail: String(error) }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("Error in set-case-owner", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

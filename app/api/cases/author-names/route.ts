import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCaseCreatorUserId } from "@/features/cases/utils/caseAuthorship";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null) as { userIds?: unknown } | null;
  if (!Array.isArray(body?.userIds) || body.userIds.length > 500) {
    return NextResponse.json({ error: "userIds must be an array of at most 500 IDs" }, { status: 400 });
  }

  const userIds = [...new Set(body.userIds.map((id) => getCaseCreatorUserId({ createdByUserId: id })).filter((id): id is string => Boolean(id)))];
  if (userIds.length === 0) return NextResponse.json({ names: {} });

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const primary = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);
  let profiles: Array<{ user_id: string; full_name?: string | null; email?: string | null }> = primary.data ?? [];
  if (primary.error) {
    const fallback = await supabase.from("profiles").select("user_id, email").in("user_id", userIds);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    profiles = fallback.data ?? [];
  }

  const names = Object.fromEntries(profiles.map((profile) => [
    profile.user_id,
    String(profile.full_name ?? "").trim() || String(profile.email ?? "").trim() || "Unknown",
  ]));
  return NextResponse.json({ names });
}

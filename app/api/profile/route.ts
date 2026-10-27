import { NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { user, role: cachedRole, adminSupabase, supabase } = auth;
    const db = adminSupabase ?? supabase;

    const PROFILE_COLUMNS =
      "user_id, email, role, full_name, created_at, force_password_change, institution_id, year_group_id";

    let { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle();
    if (error || !data) {
      const byId = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
      data = byId.data;
      error = byId.error;
    }
    if (error || !data) {
      const fallback = await db.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    if (error || !data) {
      console.warn("Error fetching profile in /api/profile:", error?.message ?? "not found");
      if (cachedRole) {
        return NextResponse.json({ profile: { user_id: user.id, role: cachedRole } });
      }
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    let yearGroupName: string | null = null;
    if (data.year_group_id) {
      const { data: yearGroup } = await db
        .from("year_groups")
        .select("name")
        .eq("id", data.year_group_id)
        .maybeSingle();
      yearGroupName = yearGroup?.name ?? null;
    }

    let institutionName: string | null = null;
    if (data.institution_id) {
      const { data: institution } = await db
        .from("institutions")
        .select("name")
        .eq("id", data.institution_id)
        .maybeSingle();
      institutionName = institution?.name ?? null;
    }

    const role = data?.role ?? cachedRole ?? null;
    return NextResponse.json({
      profile: {
        ...data,
        role,
        yearGroupId: data?.year_group_id ?? null,
        yearGroupName,
        institutionId: data?.institution_id ?? null,
        institutionName,
      },
    });
  } catch (err) {
    console.error("Unexpected error in /api/profile:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

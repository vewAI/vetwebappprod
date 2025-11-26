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

    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (error) {
      console.warn("Error fetching profile in /api/profile:", error.message);
      if (cachedRole) {
        return NextResponse.json({ profile: { user_id: user.id, role: cachedRole } });
      }
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    const role = data?.role ?? cachedRole ?? null;
    return NextResponse.json({ profile: { ...data, role } });
  } catch (err) {
    console.error("Unexpected error in /api/profile:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

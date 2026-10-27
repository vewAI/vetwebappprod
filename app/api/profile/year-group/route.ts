import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "student") {
    return NextResponse.json({ error: "Only students select a year group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const yearGroupId = typeof body?.yearGroupId === "string" ? body.yearGroupId.trim() : "";
  if (!yearGroupId) {
    return NextResponse.json({ error: "yearGroupId is required" }, { status: 400 });
  }

  const db = getSupabaseAdminClient() ?? auth.adminSupabase ?? auth.supabase;

  let { data: profile, error: profileError } = await db
    .from("profiles")
    .select("user_id, institution_id, year_group_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    const byId = await db
      .from("profiles")
      .select("user_id, institution_id, year_group_id, role")
      .eq("id", auth.user.id)
      .maybeSingle();
    profile = byId.data;
    profileError = byId.error;
  }
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.year_group_id) {
    return NextResponse.json({ error: "Year group is already assigned" }, { status: 409 });
  }
  if (!profile.institution_id) {
    return NextResponse.json({ error: "Your account is not linked to an institution" }, { status: 400 });
  }

  const { data: yearGroup, error: yearError } = await db
    .from("year_groups")
    .select("id, institution_id, name")
    .eq("id", yearGroupId)
    .maybeSingle();
  if (yearError) {
    return NextResponse.json({ error: yearError.message }, { status: 500 });
  }
  if (!yearGroup || yearGroup.institution_id !== profile.institution_id) {
    return NextResponse.json({ error: "Year group is not valid for your institution" }, { status: 400 });
  }

  let updateQuery = db.from("profiles").update({ year_group_id: yearGroupId });
  updateQuery = profile.user_id
    ? updateQuery.eq("user_id", profile.user_id)
    : updateQuery.eq("id", auth.user.id);
  const { error: updateError } = await updateQuery;
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    yearGroupId: yearGroup.id,
    yearGroupName: yearGroup.name,
  });
}

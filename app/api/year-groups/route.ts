import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";

type YearGroupRow = {
  id: string;
  institution_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  institutions?: { name: string } | null;
};

function mapRow(row: YearGroupRow): YearGroup {
  return {
    id: row.id,
    institutionId: row.institution_id,
    institutionName: Array.isArray(row.institutions) ? row.institutions[0]?.name : row.institutions?.name,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const institutionIdParam = request.nextUrl.searchParams.get("institutionId")?.trim() || "";
  const db = getSupabaseAdminClient() ?? auth.adminSupabase ?? auth.supabase;

  let institutionId = institutionIdParam;
  if (auth.role !== "admin") {
    let { data: profile, error: profileError } = await db.from("profiles").select("institution_id").eq("user_id", auth.user.id).maybeSingle();
    if (profileError || !profile) {
      const byId = await db.from("profiles").select("institution_id").eq("id", auth.user.id).maybeSingle();
      profile = byId.data;
      profileError = byId.error;
    }
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    institutionId = profile?.institution_id ?? "";
    if (!institutionId) {
      return NextResponse.json({ yearGroups: [], institutionId: null, academicYearEnd: null });
    }
  }

  const YEAR_GROUP_COLUMNS = "id, institution_id, name, sort_order, created_at";
  let query = db
    .from("year_groups")
    .select(`${YEAR_GROUP_COLUMNS}, institutions!institution_id(name)`)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (institutionId) {
    query = query.eq("institution_id", institutionId);
  }

  const queryResult = await query;
  let data: any = queryResult.data;
  let error = queryResult.error;
  if (error) {
    let fallback = db.from("year_groups").select(YEAR_GROUP_COLUMNS).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (institutionId) fallback = fallback.eq("institution_id", institutionId);
    const retry = await fallback;
    data = retry.data as any;
    error = retry.error;
  }
  if (error) {
    return NextResponse.json({ error: error.message, yearGroups: [], institutionId: institutionId || null }, { status: 500 });
  }

  let academicYearEnd: { month: number; day: number } | null = null;
  if (institutionId) {
    const { data: institution } = await db
      .from("institutions")
      .select("academic_year_end_month, academic_year_end_day")
      .eq("id", institutionId)
      .maybeSingle();
    academicYearEnd = {
      month: Number(institution?.academic_year_end_month ?? 7),
      day: Number(institution?.academic_year_end_day ?? 31),
    };
  }

  return NextResponse.json({
    yearGroups: ((data ?? []) as unknown as YearGroupRow[]).map(mapRow),
    academicYearEnd,
    institutionId: institutionId || null,
  });
}



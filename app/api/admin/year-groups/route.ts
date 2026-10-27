import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function mapYearGroup(row: {
  id: string;
  institution_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}) {
  return {
    id: row.id,
    institutionId: row.institution_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const institutionId = request.nextUrl.searchParams.get("institutionId")?.trim();
  if (!institutionId) {
    return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("year_groups")
    .select("id, institution_id, name, sort_order, created_at")
    .eq("institution_id", institutionId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ yearGroups: (data ?? []).map(mapYearGroup) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const institutionId = typeof body?.institutionId === "string" ? body.institutionId.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!institutionId || !name) {
    return NextResponse.json({ error: "institutionId and name are required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: existing } = await adminClient
    .from("year_groups")
    .select("sort_order")
    .eq("institution_id", institutionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = Number.isFinite(Number(body?.sortOrder))
    ? sortOrder
    : Number(existing?.sort_order ?? -1) + 1;

  const { data, error } = await adminClient
    .from("year_groups")
    .insert({ institution_id: institutionId, name, sort_order: nextSort })
    .select("id, institution_id, name, sort_order, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A year group with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    yearGroup: {
      id: data.id,
      institutionId: data.institution_id,
      name: data.name,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error } = await adminClient.from("year_groups").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

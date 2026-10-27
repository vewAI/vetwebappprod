import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  // Admins and Professors can view institutions
  if (auth.role !== "admin" && auth.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: institutions, error } = await adminClient
    .from("institutions")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    institutions: (institutions ?? []).map((row) => ({
      ...row,
      academic_year_end_month: Number(row.academic_year_end_month ?? 7),
      academic_year_end_day: Number(row.academic_year_end_day ?? 31),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  // Only Admins can create institutions
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("institutions")
    .insert({ name })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ institution: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body?.id;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const monthRaw = body?.academic_year_end_month;
  const dayRaw = body?.academic_year_end_day;
  const hasYearEnd = monthRaw != null || dayRaw != null;

  if (!id || (!name && !hasYearEnd)) {
    return NextResponse.json({ error: "id and name or year-end date are required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (hasYearEnd) {
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return NextResponse.json({ error: "academic year end must be a valid month and day" }, { status: 400 });
    }
    updates.academic_year_end_month = month;
    updates.academic_year_end_day = day;
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("institutions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ institution: data });
}

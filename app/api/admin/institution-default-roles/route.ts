import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const VALID_ROLES = ["student", "professor", "admin"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin" && auth.role !== "professor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const institutionId = request.nextUrl.searchParams.get("institutionId");
  if (!institutionId) {
    return NextResponse.json({ error: "institutionId is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("institution_default_roles")
    .select("id, regex, role, institution_id, priority, description, created_at")
    .eq("institution_id", institutionId)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { institutionId, regex, role, priority, description } = body as {
    institutionId?: string;
    regex?: string;
    role?: string;
    priority?: number;
    description?: string | null;
  };

  if (!institutionId || !regex || typeof regex !== "string") {
    return NextResponse.json(
      { error: "institutionId and regex are required" },
      { status: 400 }
    );
  }

  const trimmedRegex = regex.trim();
  if (!trimmedRegex) {
    return NextResponse.json({ error: "regex cannot be empty" }, { status: 400 });
  }

  const validRole =
    role != null && VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])
      ? (role as (typeof VALID_ROLES)[number])
      : "student";

  const priorityNum = typeof priority === "number" && Number.isInteger(priority) ? priority : 0;

  try {
    new RegExp(trimmedRegex);
  } catch {
    return NextResponse.json({ error: "Invalid regex pattern" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const descriptionVal = typeof description === "string" ? description.trim() || null : null;

  const { data, error } = await adminClient
    .from("institution_default_roles")
    .insert({
      institution_id: institutionId,
      regex: trimmedRegex,
      role: validRole,
      priority: priorityNum,
      description: descriptionVal,
    })
    .select("id, regex, role, institution_id, priority, description, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ role: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error } = await adminClient
    .from("institution_default_roles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, regex, role, priority, description } = body as {
    id?: number | string;
    regex?: string;
    role?: string;
    priority?: number;
    description?: string | null;
  };

  if (id == null) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof regex === "string") {
    const trimmed = regex.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "regex cannot be empty" }, { status: 400 });
    }
    try {
      new RegExp(trimmed);
    } catch {
      return NextResponse.json({ error: "Invalid regex pattern" }, { status: 400 });
    }
    updates.regex = trimmed;
  }

  if (role != null && VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    updates.role = role;
  }

  if (typeof priority === "number" && Number.isInteger(priority)) {
    updates.priority = priority;
  }

  if (description !== undefined) {
    updates.description = typeof description === "string" ? description.trim() || null : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("institution_default_roles")
    .update(updates)
    .eq("id", id)
    .select("id, regex, role, institution_id, priority, description, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ role: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { updates } = body as { updates?: { id: string | number; priority: number }[] };

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  for (const { id, priority } of updates) {
    if (id == null || typeof priority !== "number") continue;
    const { error } = await adminClient
      .from("institution_default_roles")
      .update({ priority })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Valid domain: labels of alphanumeric/hyphens, separated by dots, TLD 2+ chars (e.g. example.edu, sub.example.co.uk) */
const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

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
    .from("institution_domains")
    .select("id, domain, default_role")
    .eq("institution_id", institutionId)
    .order("domain", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domains: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { institutionId, domain, defaultRole } = body as {
    institutionId?: string;
    domain?: string;
    defaultRole?: string | null;
  };
  if (!institutionId || !domain || typeof domain !== "string") {
    return NextResponse.json(
      { error: "institutionId and domain are required" },
      { status: 400 }
    );
  }

  const trimmedDomain = domain.trim().toLowerCase();
  if (!trimmedDomain) {
    return NextResponse.json({ error: "domain cannot be empty" }, { status: 400 });
  }
  if (!DOMAIN_REGEX.test(trimmedDomain)) {
    return NextResponse.json(
      { error: "Invalid domain format. Use format like example.edu" },
      { status: 400 }
    );
  }

  const validRoles = ["student", "professor", "admin"] as const;
  const role =
    defaultRole != null && validRoles.includes(defaultRole as (typeof validRoles)[number])
      ? (defaultRole as (typeof validRoles)[number])
      : null;

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("institution_domains")
    .insert({ institution_id: institutionId, domain: trimmedDomain, default_role: role })
    .select("id, domain, default_role")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain: data });
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
    .from("institution_domains")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

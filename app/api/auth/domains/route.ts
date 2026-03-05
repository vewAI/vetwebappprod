import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Public API - returns distinct allowed email domains from institution_domains.
 * Used by the login form to restrict email entry.
 */
export async function GET() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data, error } = await adminClient
    .from("institution_domains")
    .select("domain")
    .not("domain", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const domains = [...new Set((data ?? []).map((r) => r.domain).filter(Boolean))].sort();
  return NextResponse.json({ domains });
}

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Public API - returns distinct allowed email domains from institution_domains.
 * Used by the login form to restrict email entry.
 */
const FALLBACK_DOMAINS = [
  "gmail.com",
  "nottingham.ac.uk",
  "vewai.com",
  "vewai.app",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "yahoo.com",
];

export async function GET() {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ domains: FALLBACK_DOMAINS });
  }

  try {
    const { data, error } = await adminClient
      .from("institution_domains")
      .select("domain")
      .not("domain", "is", null);

    if (error || !data || data.length === 0) {
      return NextResponse.json({ domains: FALLBACK_DOMAINS });
    }

    const domains = [...new Set((data ?? []).map((r) => r.domain).filter(Boolean))].sort();
    return NextResponse.json({ domains: domains.length > 0 ? domains : FALLBACK_DOMAINS });
  } catch {
    return NextResponse.json({ domains: FALLBACK_DOMAINS });
  }
}

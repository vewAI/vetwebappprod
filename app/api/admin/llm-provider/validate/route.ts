import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SETTINGS_KEY = "llm_provider_config";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ ok: false, error: "Supabase admin client unavailable" }, { status: 500 });

  try {
    const { data, error } = await client.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    return NextResponse.json({ ok: true, exists: !!data, value: data?.value ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export default { GET };

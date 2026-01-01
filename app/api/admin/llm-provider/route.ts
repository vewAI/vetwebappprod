import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SETTINGS_KEY = "llm_provider_config";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = getSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Server configuration missing (supabase)" }, { status: 500 });
  }

  try {
    const { data, error } = await client.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    if (error) {
      console.error("Failed to read llm config from DB", error);
      return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
    }
    if (data && data.value) {
      return NextResponse.json(data.value);
    }
  } catch (e) {
    console.error("Exception reading llm config", e);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }

  // fallback to env defaults
  return NextResponse.json({ defaultProvider: process.env.LLM_DEFAULT_PROVIDER || "openai", featureOverrides: { embeddings: process.env.LLM_PROVIDER_EMBEDDINGS || null } });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const client = getSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ error: "Server configuration missing (supabase)" }, { status: 500 });
  }

  try {
    // Upsert into app_settings table
    const { error } = await client.from("app_settings").upsert({ key: SETTINGS_KEY, value: body });
    if (error) {
      console.error("Failed to upsert llm provider config", error);
      return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
    }
    return NextResponse.json({ success: true, config: body });
  } catch (e) {
    console.error("Exception writing llm config", e);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

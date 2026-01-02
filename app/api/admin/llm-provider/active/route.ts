import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth";
import llm from "@/lib/llm";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  // Return both the persisted config and the resolved provider per-feature
  const client = getSupabaseAdminClient();
  let rawConfig: any = null;
  if (client) {
    try {
      const { data } = await client.from("app_settings").select("value").eq("key", "llm_provider_config").maybeSingle();
      rawConfig = data?.value ?? null;
    } catch (err) {
      // ignore - we'll still return resolved providers
      rawConfig = null;
    }
  }

  const features = ["embeddings", "tts", "chat"];
  const resolved: Record<string, string> = {};
  for (const f of features) {
    try {
      resolved[f] = await llm.resolveProviderForFeature(f as string);
    } catch (err) {
      resolved[f] = "error";
    }
  }

  return NextResponse.json({ ok: true, rawConfig, resolved });
}

export default { GET };

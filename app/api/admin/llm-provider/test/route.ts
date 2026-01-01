import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import llm from "@/lib/llm";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const feature = body?.feature || "embeddings";

  // Resolve provider via adapter helper
  try {
    const provider = await llm.resolveProviderForFeature(feature);
    const start = Date.now();
    if (feature === "embeddings") {
      // lightweight test
      const out = await llm.embeddings(["test"], {} as any);
      const latency = Date.now() - start;
      return NextResponse.json({ ok: true, provider, model: out?.[0]?.model ?? null, latencyMs: latency });
    }

    // For other features, respond with a simple provider resolution
    return NextResponse.json({ ok: true, provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

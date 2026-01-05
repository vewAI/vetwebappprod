import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import llm from "@/lib/llm";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const feature = body?.feature || "embeddings";
  const overrideProvider = body?.provider ?? null;
  const modelHint = body?.model ?? null;

  // Resolve provider via adapter helper
  try {
    const provider = overrideProvider ?? (await llm.resolveProviderForFeature(feature));
    const start = Date.now();
    if (feature === "embeddings") {
      // lightweight test — allow passing provider/model hints for on-the-fly testing
      const out = await llm.embeddings(["test"], { provider: provider as any, model: modelHint ?? undefined });
      const latency = Date.now() - start;
      return NextResponse.json({ ok: true, provider, model: out?.[0]?.model ?? null, latencyMs: latency });
    }

    // For other features, respond with a simple provider resolution
    return NextResponse.json({ ok: true, provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err && typeof (err as any).status === 'number') ? (err as any).status : 500;
    const detail = {
      message: msg,
      name: err instanceof Error ? err.name : undefined,
      stack: typeof err === 'object' && err && 'stack' in err ? ((err as any).stack ?? undefined) : undefined,
    };
    return NextResponse.json({ ok: false, error: msg, provider: overrideProvider ?? null, detail }, { status });
  }
}

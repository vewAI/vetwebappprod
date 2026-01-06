import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function resolveCaseIdFromCtx(ctx: any): Promise<string | undefined> | string | undefined {
  try {
    if (!ctx) return undefined;
    const p = ctx.params;
    if (!p) return undefined;
    if (typeof p.then === "function") {
      return p.then((v: any) => v?.caseId);
    }
    return p.caseId;
  } catch {
    return undefined;
  }
}

export async function GET(req: any, ctx: any) {
  const maybe = resolveCaseIdFromCtx(ctx);
  const caseId = typeof maybe === "string" ? maybe : await maybe;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ stageActivation: {} });

  try {
    const { data, error } = await supabase
      .from("cases")
      .select("settings")
      .eq("id", caseId)
      .single();
    if (error) {
      console.warn("Failed to fetch case settings", error);
      return NextResponse.json({ stageActivation: {} });
    }
    const settings = (data && (data as any).settings) || {};
    const stageActivation = settings.stageActivation || {};
    return NextResponse.json({ stageActivation });
  } catch (e) {
    console.error("Error reading stage settings", e);
    return NextResponse.json({ stageActivation: {} });
  }
}

export async function POST(req: any, ctx: any) {
  const maybe = resolveCaseIdFromCtx(ctx);
  const caseId = typeof maybe === "string" ? maybe : await maybe;
  const body = await req.json().catch(() => ({}));
  // Accept either a single stage update `{ stageIndex, active }`
  // or a full map `{ stageActivation: { "0": true, "1": false } }`.
  const { stageIndex, active, stageActivation } = body as {
    stageIndex?: number;
    active?: boolean;
    stageActivation?: Record<string, boolean>;
  };
  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase-unavailable" }, { status: 500 });

  if (!stageActivation && (typeof stageIndex !== "number" || typeof active !== "boolean")) {
    return NextResponse.json({ ok: false, error: "invalid-payload" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("cases")
      .select("settings")
      .eq("id", caseId)
      .single();
    if (error) {
      console.warn("Failed to fetch case for update", error);
      return NextResponse.json({ ok: false, error: "fetch-failed" }, { status: 500 });
    }
    const current = (data && (data as any).settings) || {};
    const activation = current.stageActivation || {};
    let nextActivation = activation;
    if (stageActivation && typeof stageActivation === "object") {
      // Replace full activation map
      nextActivation = { ...activation, ...stageActivation };
    } else {
      // Single-stage update
      nextActivation = { ...activation, [String(stageIndex)]: Boolean(active) };
    }
    const nextSettings = { ...current, stageActivation: nextActivation };
    const upd = await supabase.from("cases").update({ settings: nextSettings }).eq("id", caseId);
    if (upd.error) {
      console.error("Failed to update case settings", upd.error);
      return NextResponse.json({ ok: false, error: "update-failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, stageActivation: nextActivation });
  } catch (e) {
    console.error("Error updating stage settings", e);
    return NextResponse.json({ ok: false, error: "exception" }, { status: 500 });
  }
}

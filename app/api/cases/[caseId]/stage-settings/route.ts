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
    // Try selecting only the settings column first (most common schema)
    const res = await supabase.from("cases").select("settings").eq("id", caseId).single();
    if (res.error) {
      // If the column doesn't exist, fall back to selecting the whole row
      const msg = String(res.error.message || res.error);
      if (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("settings")) {
        const full = await supabase.from("cases").select("*").eq("id", caseId).single();
        if (full.error) {
          console.warn("Failed to fetch full case row after missing settings column", full.error);
          return NextResponse.json({ stageActivation: {} });
        }
        const settingsFallback = (full.data && (full.data as any).settings) || {};
        const stageActivationFallback = settingsFallback.stageActivation || {};
        return NextResponse.json({ stageActivation: stageActivationFallback });
      }
      console.warn("Failed to fetch case settings", res.error);
      return NextResponse.json({ stageActivation: {} });
    }
    const settings = (res.data && (res.data as any).settings) || {};
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

  if (!caseId) {
    console.warn("Missing caseId in request context when updating stage settings", { body });
    return NextResponse.json({ ok: false, error: "missing-case-id" }, { status: 400 });
  }

  if (!stageActivation && (typeof stageIndex !== "number" || typeof active !== "boolean")) {
    return NextResponse.json({ ok: false, error: "invalid-payload" }, { status: 400 });
  }

  try {
    let data: any = null;
    try {
      const res = await supabase.from("cases").select("settings").eq("id", caseId).single();
      if (res.error) {
        const msg = String(res.error.message || res.error).toLowerCase();
        if (msg.includes("column") && msg.includes("settings")) {
          // Fallback: select full row when settings column is absent in this DB
          const full = await supabase.from("cases").select("*").eq("id", caseId).single();
          if (full.error) {
            console.warn("Failed to fetch full case row after missing settings column", full.error, { caseId });
            return NextResponse.json({ ok: false, error: "fetch-failed", detail: full.error.message || String(full.error) }, { status: 500 });
          }
          data = full.data;
        } else {
          console.warn("Supabase returned error fetching case for update", res.error, { caseId });
          return NextResponse.json({ ok: false, error: "fetch-failed", detail: res.error.message || String(res.error) }, { status: 500 });
        }
      } else {
        data = res.data;
      }
    } catch (err) {
      console.error("Exception while fetching case for update", err, { caseId });
      return NextResponse.json({ ok: false, error: "fetch-exception", detail: String(err) }, { status: 500 });
    }
    const current = (data && (data as any).settings) || {};
    const activation = current.stageActivation || {};
    let nextActivation = activation;
    if (stageActivation && typeof stageActivation === "object") {
      // Replace full activation map. Coerce values to booleans in case strings were sent/stored.
      const coerced: Record<string, boolean> = {};
      Object.keys(stageActivation).forEach((k) => {
        const v = (stageActivation as any)[k];
        coerced[k] = v === true || v === "true";
      });
      nextActivation = { ...activation, ...coerced };
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

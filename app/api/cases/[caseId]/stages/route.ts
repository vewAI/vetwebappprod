import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { caseConfig } from "@/features/config/case-config";
import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { caseId } = await context.params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("case_stages")
      .select("*")
      .eq("case_id", caseId)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return NextResponse.json({ stages: data, source: "db" });
    }
  }

  const fallback = caseConfig[caseId] ?? caseConfig["case-1"];
  if (!fallback) {
    return NextResponse.json({ error: "No stages found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const fallbackRows = fallback.map((stage, idx) => ({
    id: `${caseId}-${stage.id ?? idx}`,
    case_id: caseId,
    sort_order: idx,
    title: stage.title,
    description: stage.description,
    persona_role_key: resolveChatPersonaRoleKey(stage.title, stage.role),
    role_label: stage.role,
    role_info_key: stage.roleInfoKey ?? null,
    feedback_prompt_key: stage.feedbackPromptKey ?? null,
    stage_prompt: null,
    transition_message: null,
    is_active: true,
    min_user_turns: 0,
    min_assistant_turns: 0,
    settings: {},
    created_at: now,
    updated_at: now,
  }));

  return NextResponse.json({ stages: fallbackRows, source: "hardcoded" });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { caseId } = await context.params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as {
    stages?: Array<Record<string, unknown>>;
  } | null;

  const stages = payload?.stages;
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages must be an array" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-unavailable" }, { status: 500 });
  }

  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i] as Record<string, unknown>;
    if (typeof stage.title !== "string" || stage.title.trim().length === 0) {
      return NextResponse.json({ error: `Stage ${i}: title is required` }, { status: 400 });
    }
    if (typeof stage.persona_role_key !== "string" || stage.persona_role_key.trim().length === 0) {
      return NextResponse.json({ error: `Stage ${i}: persona_role_key is required` }, { status: 400 });
    }
  }

  const { error: deleteError } = await supabase.from("case_stages").delete().eq("case_id", caseId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const rows = stages.map((stage, idx) => ({
    case_id: caseId,
    sort_order: idx,
    title: String(stage.title ?? ""),
    description: String(stage.description ?? ""),
    persona_role_key: String(stage.persona_role_key ?? "owner"),
    role_label: stage.role_label != null ? String(stage.role_label) : null,
    role_info_key: stage.role_info_key != null ? String(stage.role_info_key) : null,
    feedback_prompt_key: stage.feedback_prompt_key != null ? String(stage.feedback_prompt_key) : null,
    stage_prompt: stage.stage_prompt != null ? String(stage.stage_prompt) : null,
    transition_message: stage.transition_message != null ? String(stage.transition_message) : null,
    is_active: stage.is_active !== false,
    min_user_turns: Number(stage.min_user_turns ?? 0),
    min_assistant_turns: Number(stage.min_assistant_turns ?? 0),
    settings: typeof stage.settings === "object" && stage.settings ? stage.settings : {},
  }));

  const { data, error } = await supabase.from("case_stages").insert(rows).select("*").order("sort_order", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stages: data ?? [], count: data?.length ?? 0 });
}

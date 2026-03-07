import { NextRequest, NextResponse } from "next/server";
import { caseConfig } from "@/features/config/case-config";
import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { caseId } = await context.params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-unavailable" }, { status: 500 });
  }

  const { count, error: countError } = await supabase
    .from("case_stages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json({ seeded: false, reason: "already_exists", count });
  }

  const templateStages = caseConfig[caseId] ?? caseConfig["case-1"];
  if (!templateStages) {
    return NextResponse.json({ error: "No template found" }, { status: 404 });
  }

  const rows = templateStages.map((stage, idx) => ({
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
  }));

  const { error } = await supabase.from("case_stages").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: true, count: rows.length });
}

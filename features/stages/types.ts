export interface Stage {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  role: string;
  personaRoleKey?: string;
  roleInfoKey?: string;
  feedbackPromptKey?: string;
  stagePrompt?: string;
  transitionMessage?: string;
  isActive?: boolean;
  sortOrder?: number;
  settings?: Record<string, unknown>;
}

export interface CaseStageRow {
  id: string;
  case_id: string;
  sort_order: number;
  title: string;
  description: string;
  persona_role_key: string;
  role_label: string | null;
  role_info_key: string | null;
  feedback_prompt_key: string | null;
  stage_prompt: string | null;
  transition_message: string | null;
  is_active: boolean;
  min_user_turns: number | null;
  min_assistant_turns: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function caseStageRowToStage(row: CaseStageRow): Stage {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: false,
    role: row.role_label ?? row.title,
    personaRoleKey: row.persona_role_key,
    roleInfoKey: row.role_info_key ?? undefined,
    feedbackPromptKey: row.feedback_prompt_key ?? undefined,
    stagePrompt: row.stage_prompt ?? undefined,
    transitionMessage: row.transition_message ?? undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    settings: row.settings,
  };
}
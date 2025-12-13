export type CaseTimepoint = {
  id: string;
  case_id: string;
  sequence_index: number;
  label: string;
  summary?: string | null;
  available_after_hours?: number | null;
  after_stage_id?: string | null;
  persona_role_key?: string | null;
  stage_prompt?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreateCaseTimepointDTO = Omit<CaseTimepoint, "id" | "created_at" | "updated_at">;
export type UpdateCaseTimepointDTO = Partial<CreateCaseTimepointDTO>;

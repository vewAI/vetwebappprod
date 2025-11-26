export type PromptScope = "global" | "case" | "feedback" | "system" | "defaults";

export type PromptCategory =
  | "chat"
  | "persona"
  | "owner"
  | "feedback"
  | "defaults"
  | "misc";

export interface PromptDefinition {
  id: string;
  label: string;
  description: string;
  scope: PromptScope;
  category: PromptCategory;
  caseId?: string;
  caseField?: string;
  defaultValue: string;
  source?: string;
}

export interface PromptRecord extends PromptDefinition {
  value: string;
  hasOverride: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface PromptOverrideRow {
  id: string;
  value: string;
  updated_at: string | null;
  updated_by: string | null;
}

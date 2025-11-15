// Shared types for role info objects and prompt functions

export type RoleInfoPromptFn =
  | ((input: string) => string)
  | ((caseData: Record<string, unknown> | null, input: string) => string);

/**
 * RoleInfo objects may include any number of string data fields or prompt functions.
 * Prompt functions must match the RoleInfoPromptFn signature.
 */
export interface RoleInfo {
  [key: string]: string | RoleInfoPromptFn;
}

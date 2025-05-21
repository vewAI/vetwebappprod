// Shared types for role info objects and prompt functions

/**
 * A prompt function takes an input string (usually the user's message or chat context)
 * and returns a formatted prompt string for the AI.
 */
export type RoleInfoPromptFn = (input: string) => string;

/**
 * RoleInfo objects may include any number of string data fields or prompt functions.
 * Prompt functions must match the RoleInfoPromptFn signature.
 */
export interface RoleInfo {
  [key: string]: string | RoleInfoPromptFn;
}

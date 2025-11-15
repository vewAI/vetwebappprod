import { case1RoleInfo } from "../case1";
import { dbRoleInfo } from "../db-role-info";
import { caseConfig } from "@/features/config/case-config";
import type { RoleInfo, RoleInfoPromptFn } from "../types";
import { supabase } from "@/lib/supabase";

const caseRoleInfoMap: Record<string, RoleInfo> = {
  "case-1": case1RoleInfo,
};

/**
 * Gets a role-specific prompt for the given case and stage.
 * Only calls the prompt function if it exists and matches the expected signature.
 */
export async function getRoleInfoPrompt(
  caseId: string,
  stageIndex: number,
  userMessage: string
): Promise<string | null> {
  // Check if the caseId is valid
  if (!isCaseIdValid(caseId)) {
    console.warn(`Invalid case ID: ${caseId}`);
    return null;
  }

  // Get the role info object for this case (with type assertion)
  const roleInfo = caseRoleInfoMap[caseId] ?? dbRoleInfo;

  // Get the stages for this case from the config
  const caseStages = caseConfig[caseId];
  if (!caseStages || !caseStages[stageIndex]) {
    return null;
  }

  const stage = caseStages[stageIndex];
  if (!stage.roleInfoKey) {
    return null;
  }

  // Fetch case-specific row from Supabase in case templates want injected data
  let caseRow: Record<string, any> | null = null;
  try {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    if (!error && data) {
      caseRow = data as Record<string, any>;
    }
  } catch (e) {
    console.warn("Error fetching case row for role info prompts:", e);
  }

  // Get the prompt function using the roleInfoKey
  const promptFunction = roleInfo[stage.roleInfoKey];

  // If the prompt function exists and is callable, invoke it.
  if (typeof promptFunction === "function") {
    try {
      // If the prompt function declares two parameters (caseData, context), call with caseRow
      if ((promptFunction as Function).length >= 2) {
        return (promptFunction as any)(caseRow, userMessage);
      }
      // Otherwise call with the old single-argument signature
      return (promptFunction as RoleInfoPromptFn)(userMessage);
    } catch (err) {
      console.warn("Error executing role info prompt function:", err);
      return null;
    }
  }
  // check if the key exists but is not a function
  if (promptFunction !== undefined) {
    console.warn(
      `roleInfoKey "${stage.roleInfoKey}" exists but is not a function in role info for case "${caseId}".`
    );
  }

  return null;
}

// Function to check if the caseId is valid
function isCaseIdValid(caseId: string): boolean {
  return Boolean(caseConfig[caseId]) || Boolean(caseRoleInfoMap[caseId]);
}

// Function to get all available case IDs
export function getAvailableCaseIds(): string[] {
  const configuredIds = Object.keys(caseConfig ?? {});
  const explicitIds = Object.keys(caseRoleInfoMap);
  return Array.from(new Set([...configuredIds, ...explicitIds]));
}

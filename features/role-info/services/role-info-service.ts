import { case1RoleInfo } from "../case1";
import { caseConfig } from "@/features/config/case-config";

type CaseId = 'case-1';
// add more cases here

interface RoleInfo {
  [key: string]: any;
}
const caseRoleInfoMap: Record<CaseId, RoleInfo> = {
  "case-1": case1RoleInfo,
  // "case-2": case2RoleInfo,
};

export function getRoleInfoPrompt(
  caseId: string,
  stageIndex: number,
  userMessage: string
): string | null {
  // Check if the caseId is valid
  if (!isCaseIdValid(caseId)) {
    console.warn(`Invalid case ID: ${caseId}`);
    return null;
  }

  // Get the role info object for this case (with type assertion)
  const roleInfo = caseRoleInfoMap[caseId as CaseId];
  if (!roleInfo) {
    return null;
  }

  // Get the stages for this case from the config
  const caseStages = caseConfig[caseId];
  if (!caseStages || !caseStages[stageIndex]) {
    return null;
  }

  const stage = caseStages[stageIndex];
  if (!stage.roleInfoKey) {
    return null;
  }

  // Get the prompt function using the roleInfoKey
  const promptFunction = roleInfo[stage.roleInfoKey];

  // If the prompt function exists and is callable, return the result
  if (typeof promptFunction === 'function') {
    return promptFunction(userMessage);
  }

  return null;
}

// Function to check if the caseId is valid
function isCaseIdValid(caseId: string): caseId is CaseId {
  return Object.keys(caseRoleInfoMap).includes(caseId);
}

// Function to get all available case IDs
export function getAvailableCaseIds(): string[] {
  return Object.keys(caseRoleInfoMap);
}
import { caseConfig } from "@/features/config/case-config";
import type { Stage } from "../types";
import type { Message } from "@/features/chat/models/chat";
import { getTransitionMessage as getCase1TransitionMessage } from "../case1";

/**
 * Get the stages for a specific case
 * @param caseId The ID of the case
 * @returns Array of stages for the specified case
 */
export function getStagesForCase(caseId: string): Stage[] {
  const stages = caseConfig[caseId];
  if (!stages) {
    console.warn(`No stage definition found for case ${caseId}, using case-1 as fallback`);
    return caseConfig["case-1"];
  }
  return stages;
}

/**
 * Get a transition message for a specific stage in a case
 * Add new cases to the switch below as you expand the app.
 */
export function getStageTransitionMessage(caseId: string, stageIndex: number): Message {
  switch (caseId) {
    case "case-1":
      return getCase1TransitionMessage(stageIndex);
    // case "case-2":
    //   return getCase2TransitionMessage(stageIndex);
    default:
      return {
        id: `stage-transition-${stageIndex}`,
        role: "system",
        content: "Transition message not available for this case.",
        timestamp: new Date().toISOString(),
        stageIndex,
      };
  }
}

/**
 * Initialise stages with the first stage marked as completed
 * @param stages Array of stages to initialise
 * @returns A new array with the first stage marked as completed
 */
export function initializeStages(stages: Stage[]): Stage[] {
  if (stages.length === 0) return [];
  
  const initializedStages = [...stages];
  initializedStages[0] = { ...initializedStages[0], completed: true };
  
  return initializedStages;
}

/**
 * Mark a stage as completed and return the updated stages array
 * @param stages Current stages array
 * @param stageIndex Index of the stage to mark as completed
 * @returns New array with the specified stage marked as completed
 */
export function markStageCompleted(stages: Stage[], stageIndex: number): Stage[] {
  if (stageIndex < 0 || stageIndex >= stages.length) {
    return stages;
  }
  
  const updatedStages = [...stages];
  updatedStages[stageIndex] = { ...updatedStages[stageIndex], completed: true };
  
  return updatedStages;
}
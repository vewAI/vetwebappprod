import case1StageDefinition from "../case1";
import type { Stage, StageDefinition } from "../types";
import type { Message } from "@/features/chat/models/chat";

// Simple mapping of case IDs to their stage definitions
const caseStageMap: Record<string, StageDefinition> = {
  "case-1": case1StageDefinition,
  // Add more cases here as needed in the future
};

/**
 * Get the stages for a specific case
 * @param caseId The ID of the case
 * @returns Array of stages for the specified case
 */
export function getStagesForCase(caseId: string): Stage[] {
  const stageDefinition = caseStageMap[caseId];
  
  if (!stageDefinition) {
    console.warn(`No stage definition found for case ${caseId}, using case-1 as fallback`);
    return case1StageDefinition.stages;
  }
  
  return stageDefinition.stages;
}

/**
 * Get a transition message for a specific stage in a case
 * @param caseId The ID of the case
 * @param stageIndex The index of the stage
 * @returns A message object for the stage transition
 */
export function getStageTransitionMessage(caseId: string, stageIndex: number): Message {
  const stageDefinition = caseStageMap[caseId];
  
  if (!stageDefinition) {
    console.warn(`No stage definition found for case ${caseId}, using case-1 as fallback`);
    return case1StageDefinition.getTransitionMessage(stageIndex);
  }
  
  return stageDefinition.getTransitionMessage(stageIndex);
}

/**
 * Initialize stages with the first stage marked as completed
 * @param stages Array of stages to initialize
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
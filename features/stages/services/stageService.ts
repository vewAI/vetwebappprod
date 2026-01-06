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
    console.warn(
      `No stage definition found for case ${caseId}, using case-1 as fallback`
    );
    return caseConfig["case-1"];
  }
  return stages;
}

// Fetch stages for a case and apply server-side activation overrides when available.
export async function getActiveStagesForCase(caseId: string): Promise<Stage[]> {
  const stages = getStagesForCase(caseId) ?? [];
  try {
    const resp = await fetch(`/api/cases/${encodeURIComponent(caseId)}/stage-settings`);
    if (!resp.ok) return stages;
    const payload = await resp.json().catch(() => ({}));
    const activation = payload?.stageActivation || {};
    const filtered = stages.filter((s, idx) => {
      const key = String(idx);
      if (activation.hasOwnProperty(key)) {
        return Boolean(activation[key]);
      }
      // default: present
      return true;
    });
    return filtered;
  } catch (e) {
    console.warn("Failed to load active stage settings", e);
    return stages;
  }
}

/**
 * Get a transition message for a specific stage in a case
 * Add new cases to the switch below as you expand the app.
 */
export function getStageTransitionMessage(
  caseId: string,
  stageIndex: number
): Message {
  switch (caseId) {
    case "case-1":
      return getCase1TransitionMessage(stageIndex);
    // case "case-2":
    //   return getCase2TransitionMessage(stageIndex);
    default:
      // Provide a sensible generic transition message using the case config
      // so all cases have a transition when a stage button is pushed.
      const stages = getStagesForCase(caseId);
      const stage = stages && stages[stageIndex];
      const title = stage?.title ?? `Stage ${stageIndex + 1}`;
      const desc =
        stage?.description ?? "Proceed to the next part of the case.";
      return {
        id: `stage-transition-${stageIndex}`,
        role: "system",
        content: `Proceeding to ${title}. ${desc} If you have any media items or results marked [AUTO-SHOW], you must present them immediately without waiting for a request.`,
        timestamp: new Date().toISOString(),
        stageIndex,
      };
  }
}

const STAGE_TIP_FALLBACKS: Record<string, string> = {
  history:
    "Stage tip: Start the clinical interview and gather all the information you can about the case.",
  physical:
    "Stage tip: Ask the nurse about all the examination findings you consider necessary.",
  diagnostics:
    "Stage tip: Explain the probable diagnostics and the tests you'd like to run.",
  lab:
    "Stage tip: Ask the nurse for all the test results and diagnostic imaging you may need.",
  plan:
    "Stage tip: Give indications to the nurse with details about the treatment plan.",
  communication:
    "Stage tip: Explain the final diagnostic and treatment options you can offer.",
};

function classifyStageForTip(title: string | undefined, description: string | undefined): keyof typeof STAGE_TIP_FALLBACKS {
  const source = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (source.includes("history")) return "history";
  if (source.includes("physical")) return "physical";
  if (source.includes("lab") || source.includes("test")) return "lab";
  if (source.includes("diagnostic") || source.includes("follow-up")) return "diagnostics";
  if (source.includes("plan") || source.includes("treatment") || source.includes("diagnosis")) return "plan";
  if (source.includes("communication")) return "communication";
  return "plan";
}

export function getStageTip(caseId: string, stageIndex: number): string {
  const stages = getStagesForCase(caseId);
  const stage = stages?.[stageIndex];
  const tipSource = stage?.description?.trim();
  if (tipSource) {
    return tipSource.startsWith("Stage tip:")
      ? tipSource
      : `Stage tip: ${tipSource}`;
  }

  const fallbackKey = classifyStageForTip(stage?.title, stage?.description);
  return STAGE_TIP_FALLBACKS[fallbackKey];
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
export function markStageCompleted(
  stages: Stage[],
  stageIndex: number
): Stage[] {
  if (stageIndex < 0 || stageIndex >= stages.length) {
    return stages;
  }

  const updatedStages = [...stages];
  updatedStages[stageIndex] = { ...updatedStages[stageIndex], completed: true };

  return updatedStages;
}

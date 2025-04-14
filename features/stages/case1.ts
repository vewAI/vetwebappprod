// /features/chat/stages/case-1-stages.ts
import { Stage, StageDefinition } from "./types";
import type { Message } from "@/features/chat/models/chat";

// Equine High Temperature (Strangles) - Case 1
export const stages: Stage[] = [
  {
    id: "stage-1",
    title: "Introduction",
    description: "Introduce yourself and obtain consent",
    completed: false,
    role: "Virtual Examiner"
  },
  {
    id: "stage-2",
    title: "History Taking",
    description: "Gather relevant history from the client",
    completed: false,
    role: "Client (Horse Owner)"
  },
  {
    id: "stage-3",
    title: "Physical Examination",
    description: "Perform appropriate physical exam",
    completed: false,
    role: "Veterinary Assistant"
  },
  {
    id: "stage-4",
    title: "Diagnostic Plan",
    description: "Develop a diagnostic plan",
    completed: false,
    role: "Laboratory Technician"
  },
  {
    id: "stage-5",
    title: "Treatment Plan",
    description: "Develop a treatment plan",
    completed: false,
    role: "Client (Horse Owner)"
  },
  {
    id: "stage-6",
    title: "Client Communication",
    description: "Communicate findings and recommendations",
    completed: false,
    role: "Client (Horse Owner)"
  },
];

export function getTransitionMessage(stageIndex: number): Message {
  let content = "";

  switch (stageIndex) {
    case 0:
      content =
        "Let's begin with introductions. Please introduce yourself to the client and explain the purpose of today's examination.";
      break;
    case 1:
      content =
        "Now, let's move on to history taking. Ask relevant questions about the horse's condition, history, and current symptoms.";
      break;
    case 2:
      content =
        "It's time for the physical examination. Describe what you would do to examine this horse, being specific about your approach.";
      break;
    case 3:
      content = "Based on your findings, what diagnostic tests would you recommend for this potential infectious disease case? Please explain your reasoning.";
      break;
    case 4:
      content =
        "Now, develop a treatment plan for this horse. What medications, procedures, or management changes would you recommend?";
      break;
    case 5:
      content =
        "Finally, communicate your findings and recommendations to the client. Remember to discuss isolation procedures and yard biosecurity.";
      break;
    default:
      content = "Please proceed with the current stage of the examination.";
  }

  return {
    id: `stage-transition-${stageIndex}`,
    role: "system",
    content,
    timestamp: new Date().toISOString(),
    stageIndex,
  };
}

const case1StageDefinition: StageDefinition = {
  stages,
  getTransitionMessage,
};

export default case1StageDefinition;
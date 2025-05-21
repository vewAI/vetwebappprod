import type { Message } from "@/features/chat/models/chat";

// Equine High Temperature transition messages
export function getTransitionMessage(stageIndex: number): Message {
  let content = "";

  switch (stageIndex) {
    case 0:
      content =
        "Now, let's move on to history taking. Ask relevant questions about the horse's condition, history, and current symptoms.";
      break;
    case 1:
      content =
        "It's time for the physical examination. Describe what you would do to examine this horse, being specific about your approach.";
      break;
    case 2:
      content =
        "Based on your physical exam findings, converse with Catalina's owner to suggest follow up tests that need to be done.";
      break;
    case 3:
      content = "Consult with the laboratoy technician to find the results of the tests.";
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

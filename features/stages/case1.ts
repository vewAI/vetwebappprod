import type { Message } from "@/features/chat/models/chat";

// Equine High Temperature transition messages
export function getTransitionMessage(stageIndex: number): Message {
  let content = "";

  switch (stageIndex) {
    case 0:
      content =
        "You are the owner. Start by explaining the horse's presenting complaint and the key symptoms you've noticed, then answer the clinician's questions with the recorded details only—stay consistent with what's documented and avoid adding new problems.";
      break;
    case 1:
      content =
        "Report physical examination findings exactly as recorded whenever the student asks. Do not coach or suggest steps.";
      break;
    case 2:
      content =
        "Answer the owner's follow-up questions with factual information only. Offer no guidance unless directly requested.";
      break;
    case 3:
      content =
        "Provide the exact laboratory results the student requests, without interpretation or recommendations.";
      break;
    case 4:
      content =
        "Share assessment data already on record when the student asks. Do not offer planning advice unprompted.";
      break;
    case 5:
      content =
        "Respond to client questions with the recorded diagnosis and plan details only when they are requested.";
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

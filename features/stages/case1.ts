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
      content =
        "Consult with the laboratoy technician to find the results of the tests.";
      break;
    case 4:
      content =
        "Based on the test results, prepare to communicate your diagnosis and treatment plan to the client. Consider what information they need to know.";
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

// Short, actionable instructions shown in the UI when the student enters a stage
export function getInstruction(stageIndex: number): string {
  switch (stageIndex) {
    case 0:
      return (
        "History-taking — Ask open-ended questions about onset, appetite, behaviour, " +
        "exposure/travel and vaccination history. Probe for red flags (fever, nasal discharge, " +
        "reduced faecal output) and avoid leading questions. Aim to collect the minimal critical data to form a differential."
      );
    case 1:
      return (
        "Physical exam — Work systematically: general demeanour, temperature, heart/respiratory rate, " +
        "regional lymph nodes, ENT/airway, and any focused exam of affected areas. Report objective findings succinctly."
      );
    case 2:
      return (
        "Diagnostic planning — Prioritise targeted tests (eg. nasopharyngeal PCR/culture, targeted bloods, lymph node FNA/ultrasound). " +
        "Explain rationale, urgency and approximate cost to the owner. Avoid broad, low-value testing first."
      );
    case 3:
      return (
        "Laboratory consultation — Request specific tests, clarify sample type and turnaround time, and ask how results will be reported. " +
        "Be precise about what you need and why."
      );
    case 4:
      return (
        "Diagnosis & management — Summarise key findings, list most likely differentials, and propose a treatment/monitoring plan. " +
        "Include biosecurity and isolation advice if infectious disease is suspected."
      );
    case 5:
      return "Final communication — Deliver a clear, empathetic summary to the owner: diagnosis, next steps, costs, isolation instructions, and signs that should prompt urgent re-contact. Obtain informed consent for the plan.";
    default:
      return "Proceed with the current stage; focus on concise, clinically-relevant communication and clear next steps for the owner.";
  }
}

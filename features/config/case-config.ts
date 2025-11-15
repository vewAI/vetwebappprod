import type { Stage } from "@/features/stages/types";

export const caseConfig: { [caseId: string]: Stage[] } = {
  "case-1": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Take a detailed history from the horse owner.",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Perform a physical examination of the horse.",
      completed: false,
      role: "Veterinarian",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Owner Follow-up",
      description: "Talk to the owner about tests needed to confirm diagnosis",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Test Results",
      description: "Consult with the laboratory technician about test results",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description: "Communicate findings and recommendations",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerDiagnosisPrompt",
    },
  ],
  "case-2": [
    {
      id: "stage-1",
      title: "History Taking",
      description:
        "Gather a thorough history from Milo's owner, focusing on vaccination status, exposure risks, and onset of clinical signs.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Perform a system-based physical examination with emphasis on hydration status and abdominal pain.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Discuss recommended diagnostics and isolation protocols with the owner.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory Review",
      description:
        "Review lab findings with the in-house technician and interpret key abnormalities.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description:
        "Deliver the diagnosis and outline treatment plus home-care instructions.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerDiagnosisPrompt",
    },
  ],
  "case-3": [
    {
      id: "stage-1",
      title: "History Taking",
      description:
        "Interview the dairy producer about herd-level mastitis concerns and recent management changes.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Conduct a focused exam on the affected quarter and evaluate udder health indicators.",
      completed: false,
      role: "Veterinary Assistant",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Explain culture, PCR, and milk-record data needs to the producer and prioritise testing.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory Review",
      description:
        "Discuss microbiology findings with the diagnostic laboratory contact.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description:
        "Deliver the diagnosis, outline treatment, and design a herd-level prevention plan.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerDiagnosisPrompt",
    },
  ],
};

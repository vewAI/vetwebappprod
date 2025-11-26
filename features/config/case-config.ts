import type { Stage } from "@/features/stages/types";

export const caseConfig: { [caseId: string]: Stage[] } = {
  "case-1": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Share the recorded presenting complaint and history, volunteering relevant observations that stay consistent with the documented condition.",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Report physical examination findings exactly as recorded when asked.",
      completed: false,
      role: "Veterinarian",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Owner Follow-up",
      description: "Provide factual answers to owner follow-up questions when requested.",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Test Results",
      description: "Share laboratory findings verbatim when the student asks.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description: "Answer client questions with the documented diagnosis and plan.",
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
        "Share Milo's recorded presenting complaint and timeline, volunteering observations that stay consistent with the documented condition.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Report physical examination findings exactly as documented whenever the student asks.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Respond to owner diagnostic questions with factual information only when asked.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory Review",
      description:
        "Provide the exact lab findings requested without interpretation or advice.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description:
        "Answer the client's questions with the documented diagnosis and plan only when prompted.",
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
        "Share the producer's recorded concerns and observations, volunteering context that stays consistent with the documented condition.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Report the documented udder and physical findings whenever the student asks.",
      completed: false,
      role: "Veterinary Assistant",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Answer producer questions about diagnostics with factual information only when prompted.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory Review",
      description:
        "Provide the microbiology findings exactly as recorded when requested.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Client Communication",
      description:
        "Respond to client questions with the documented diagnosis, plan, and prevention data when asked.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerDiagnosisPrompt",
    },
  ],
};

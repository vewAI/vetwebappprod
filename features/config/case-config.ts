export const caseConfig: { [caseId: string]: any } = {
  "case-1": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Take a detailed history from the horse owner.",
      completed: false,
      role: "Veterinary Student",
      roleInfoKey: "getHistoryPrompt"
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Perform a physical examination of the horse.",
      completed: false,
      role: "Veterinary Student",
      roleInfoKey: "getExamPrompt"
    },
    {
      id: "stage-3",
      title: "Owner Follow-up",
      description: "Talk to the owner about tests needed to confirm diagnosis",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt"
    },
    {
      id: "stage-4",
      title: "Diagnostic Plan",
      description: "Develop a diagnostic plan based on tests results",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt"
    },
    {
      id: "stage-5",
      title: "Treatment Plan",
      description: "Develop a treatment plan",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerDiagnosisPrompt"
    },
    {
      id: "stage-6",
      title: "Client Communication",
      description: "Communicate findings and recommendations",
      completed: false,
      role: "Client (Horse Owner)"
    }
  ]
};

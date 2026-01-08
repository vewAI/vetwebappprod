import type { Stage } from "@/features/stages/types";

export const caseConfig: { [caseId: string]: Stage[] } = {
  "case-1": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Start the clinical interview and gather all the information you can about the case.",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Ask the nurse about all the examination findings you consider necessary.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description: "Explain the probable diagnostics and the tests you'd like to run.",
      completed: false,
      role: "Client (Horse Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory & Tests",
      description: "Ask the nurse for all the test results and diagnostic imaging you may need.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Treatment Plan",
      description: "Give indications to the nurse with details about the treatment plan.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getTreatmentPlanPrompt",
    },
    {
      id: "stage-6",
      title: "Client Communication",
      description: "Explain the final diagnostic and treatment options you can offer.",
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
        "Start the clinical interview and gather all the information you can about the case.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Ask the nurse about all the examination findings you consider necessary.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Explain the probable diagnostics and the tests you'd like to run.",
      completed: false,
      role: "Client (Dog Owner)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory & Tests",
      description:
        "Ask the nurse for all the test results and diagnostic imaging you may need.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Treatment Plan",
      description: "Give indications to the nurse with details about the treatment plan.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getTreatmentPlanPrompt",
    },
    {
      id: "stage-6",
      title: "Client Communication",
      description:
        "Explain the final diagnostic and treatment options you can offer.",
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
        "Start the clinical interview and gather all the information you can about the case.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description:
        "Ask the nurse about all the examination findings you consider necessary.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnostic Planning",
      description:
        "Explain the probable diagnostics and the tests you'd like to run.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerFollowUpPrompt",
      feedbackPromptKey: "getOwnerFollowUpFeedbackPrompt",
    },
    {
      id: "stage-4",
      title: "Laboratory & Tests",
      description:
        "Ask the nurse for all the test results and diagnostic imaging you may need.",
      completed: false,
      role: "Laboratory Technician",
      roleInfoKey: "getDiagnosticPrompt",
    },
    {
      id: "stage-5",
      title: "Treatment Plan",
      description: "Give indications to the nurse with details about the treatment plan.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getTreatmentPlanPrompt",
    },
    {
      id: "stage-6",
      title: "Client Communication",
      description:
        "Explain the final diagnostic and treatment options you can offer.",
      completed: false,
      role: "Producer (Dairy Farmer)",
      roleInfoKey: "getOwnerDiagnosisPrompt",
    },
  ],
  "case-4": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Start the clinical interview and gather all the information you can about the case.",
      completed: false,
      role: "Client",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Ask the nurse about all the examination findings you consider necessary.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
      feedbackPromptKey: "getPhysicalExamFeedbackPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnosis & Treatment",
      description: "Formulate your diagnosis and treatment plan.",
      completed: false,
      role: "Professor",
      roleInfoKey: "getDiagnosisPrompt",
      feedbackPromptKey: "getDiagnosisFeedbackPrompt",
    }
  ],
  "case-5": [
    {
      id: "stage-1",
      title: "History Taking",
      description: "Start the clinical interview and gather all the information you can about the case.",
      completed: false,
      role: "Client",
      roleInfoKey: "getOwnerPrompt",
      feedbackPromptKey: "getHistoryFeedbackPrompt",
    },
    {
      id: "stage-2",
      title: "Physical Examination",
      description: "Ask the nurse about all the examination findings you consider necessary.",
      completed: false,
      role: "Veterinary Nurse",
      roleInfoKey: "getPhysicalExamPrompt",
      feedbackPromptKey: "getPhysicalExamFeedbackPrompt",
    },
    {
      id: "stage-3",
      title: "Diagnosis & Treatment",
      description: "Formulate your diagnosis and treatment plan.",
      completed: false,
      role: "Professor",
      roleInfoKey: "getDiagnosisPrompt",
      feedbackPromptKey: "getDiagnosisFeedbackPrompt",
    }
  ],
};

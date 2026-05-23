import { case1RoleInfo } from "@/features/role-info/case1";

const roleInfo = case1RoleInfo;

const feedbackFn = (key: keyof typeof roleInfo) => {
  return roleInfo[key] as (context: string) => string;
};

const caseFeedbackEntries = (caseId: string) => ({
  getHistoryFeedbackPrompt: feedbackFn("getHistoryFeedbackPrompt"),
  getPhysicalExamFeedbackPrompt: feedbackFn("getPhysicalExamFeedbackPrompt"),
  getOwnerFollowUpFeedbackPrompt: feedbackFn("getOwnerFollowUpFeedbackPrompt"),
  getDiagnosticFeedbackPrompt: feedbackFn("getDiagnosticFeedbackPrompt"),
  getTreatmentPlanFeedbackPrompt: feedbackFn("getTreatmentPlanFeedbackPrompt"),
  getOwnerDiagnosisFeedbackPrompt: feedbackFn("getOwnerDiagnosisFeedbackPrompt"),
});

// Central registry for feedback prompt functions by key
export const feedbackPromptRegistry: Record<string, Record<string, (context: string) => string>> = {
  "case-1": caseFeedbackEntries("case-1"),
  "case-2": caseFeedbackEntries("case-2"),
  "case-3": caseFeedbackEntries("case-3"),
  "case-4": caseFeedbackEntries("case-4"),
  "case-5": caseFeedbackEntries("case-5"),
};

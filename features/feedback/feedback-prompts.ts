import { case1RoleInfo } from "@/features/role-info/case1";

// Central registry for feedback prompt functions by key
export const feedbackPromptRegistry: Record<string, Record<string, (context: string) => string>> = {
  "case-1": {
    getHistoryFeedbackPrompt: case1RoleInfo.getHistoryFeedbackPrompt as (context: string) => string,
    getOwnerFollowUpFeedbackPrompt: case1RoleInfo.getOwnerFollowUpFeedbackPrompt as (context: string) => string,
  },
};

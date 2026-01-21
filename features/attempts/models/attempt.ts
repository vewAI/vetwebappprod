export interface Attempt {
  id: string;
  userId: string;
  caseId: string;
  title: string;
  createdAt: string;
  completedAt?: string;
  completionStatus: "in_progress" | "completed" | "abandoned";
  overallFeedback?: string;
  professorFeedback?: string;
  // Timestamp when the student last read professor feedback (nullable)
  feedbackReadAt?: string;
  lastStageIndex: number;
  timeSpentSeconds: number;
}

export interface AttemptSummary {
  id: string;
  userId: string;
  caseId: string;
  title: string;
  createdAt: string;
  completedAt?: string;
  completionStatus: "in_progress" | "completed" | "abandoned";
  feedbackReadAt?: string;
  lastStageIndex: number;
  timeSpentSeconds: number;
  // NEW: Case details (joined from cases table)
  caseTitle: string;
  caseCategory: string;
  caseDifficulty: string;
  caseImageUrl: string | null;
}

export interface AttemptMessage {
  id: string;
  attemptId: string;
  role: string;
  content: string;
  timestamp: string;
  stageIndex: number;
  displayRole?: string;
}

export interface AttemptFeedback {
  id: string;
  attemptId: string;
  stageIndex: number;
  feedbackContent: string;
  createdAt: string;
}

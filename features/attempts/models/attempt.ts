export interface Attempt {
    id: string;
    userId: string;
    caseId: string;
    title: string;
    createdAt: string;
    completedAt?: string;
    completionStatus: 'in_progress' | 'completed' | 'abandoned';
    overallFeedback?: string;
    lastStageIndex: number;
    timeSpentSeconds: number;
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
import {
  Attempt,
  AttemptFeedback,
  AttemptMessage,
  AttemptSummary,
} from "../models/attempt";

type DbAttempt = {
  id?: string;
  user_id?: string;
  case_id?: string;
  title?: string;
  created_at?: string;
  completed_at?: string | null;
  completion_status?: string;
  overall_feedback?: string | null;
  professor_feedback?: string | null;
  last_stage_index?: number;
  time_spent_seconds?: number;
};

type DbMessage = {
  id?: string;
  attempt_id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
  stage_index?: number;
  display_role?: string | null;
};

type DbFeedback = {
  id?: string;
  attempt_id?: string;
  stage_index?: number;
  feedback_content?: string;
  created_at?: string;
};

// Helper functions to transform database objects to our interfaces
export function transformAttempt(data: DbAttempt): Attempt {
  return {
    id: data.id ?? "",
    userId: data.user_id ?? "",
    caseId: data.case_id ?? "",
    title: data.title ?? "",
    createdAt: data.created_at ?? "",
    completedAt: data.completed_at ?? undefined,
    completionStatus: (() => {
      const cs = String(data.completion_status ?? "in_progress");
      if (cs === "completed") return "completed" as const;
      if (cs === "abandoned") return "abandoned" as const;
      return "in_progress" as const;
    })(),
    overallFeedback: data.overall_feedback ?? undefined,
    professorFeedback: data.professor_feedback ?? undefined,
    feedbackReadAt: (data as any).feedback_read_at ?? undefined,
    lastStageIndex: Number(data.last_stage_index ?? 0),
    timeSpentSeconds: Number(data.time_spent_seconds ?? 0),
  };
}

export function transformAttemptSummary(data: any): AttemptSummary {
  return {
    id: data.id ?? "",
    userId: data.user_id ?? "",
    caseId: data.case_id ?? "",
    title: data.title ?? "",
    createdAt: data.created_at ?? "",
    completedAt: data.completed_at ?? undefined,
    completionStatus: (() => {
      const cs = String(data.completion_status ?? "in_progress");
      if (cs === "completed") return "completed" as const;
      if (cs === "abandoned") return "abandoned" as const;
      return "in_progress" as const;
    })(),
    feedbackReadAt: (data as any).feedback_read_at ?? undefined,
    lastStageIndex: Number(data.last_stage_index ?? 0),
    timeSpentSeconds: Number(data.time_spent_seconds ?? 0),
    caseTitle: data.cases?.title ?? "",
    caseCategory: data.cases?.category ?? "",
    caseDifficulty: data.cases?.difficulty ?? "",
    caseImageUrl: data.cases?.image_url ?? null,
  };
}

export function transformMessage(data: DbMessage): AttemptMessage {
  return {
    id: data.id ?? "",
    attemptId: data.attempt_id ?? "",
    role: (data.role as "user" | "assistant" | "system") ?? "system",
    content: data.content ?? "",
    timestamp: data.timestamp ?? new Date().toISOString(),
    stageIndex: Number(data.stage_index ?? 0),
    displayRole: data.display_role ?? undefined,
  };
}

export function transformFeedback(data: DbFeedback): AttemptFeedback {
  return {
    id: data.id ?? "",
    attemptId: data.attempt_id ?? "",
    stageIndex: Number(data.stage_index ?? 0),
    feedbackContent: data.feedback_content ?? "",
    createdAt: data.created_at ?? "",
  };
}

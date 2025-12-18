import { supabase } from "@/lib/supabase";
import { Attempt, AttemptMessage, AttemptFeedback } from "../models/attempt";

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
    lastStageIndex: Number(data.last_stage_index ?? 0),
    timeSpentSeconds: Number(data.time_spent_seconds ?? 0),
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

// Get all attempts for the current user
export async function getUserAttempts(): Promise<Attempt[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attempts:", error);
      return [];
    }

    return data.map(transformAttempt);
  } catch (error) {
    console.error("Unexpected error fetching attempts:", error);
    return [];
  }
}

// Get attempts for a specific case
export async function getAttemptsByCase(caseId: string): Promise<Attempt[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attempts for case:", error);
      return [];
    }

    return data.map(transformAttempt);
  } catch (error) {
    console.error("Unexpected error fetching attempts for case:", error);
    return [];
  }
}

// Get a specific attempt with all messages and feedback
export async function getAttemptById(attemptId: string): Promise<{
  attempt: Attempt | null;
  messages: AttemptMessage[];
  feedback: AttemptFeedback[];
}> {
  // Get attempt
  const { data: attemptData, error: attemptError } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (attemptError || !attemptData) {
    console.error("Error fetching attempt:", attemptError);
    return { attempt: null, messages: [], feedback: [] };
  }

  // Get messages
  const { data: messagesData, error: messagesError } = await supabase
    .from("attempt_messages")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("timestamp", { ascending: true });

  if (messagesError) {
    console.error("Error fetching messages:", messagesError);
  }

  // Get feedback
  const { data: feedbackData, error: feedbackError } = await supabase
    .from("attempt_feedback")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("stage_index", { ascending: true });

  if (feedbackError) {
    console.error("Error fetching feedback:", feedbackError);
  }

  return {
    attempt: transformAttempt(attemptData),
    messages: (messagesData || []).map(transformMessage),
    feedback: (feedbackData || []).map(transformFeedback),
  };
}

export async function getAttemptsByUserId(userId: string): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching attempts:", error);
    return [];
  }

  return data.map(transformAttempt);
}

import { supabase } from "@/lib/supabase";
import { Attempt, AttemptMessage, AttemptFeedback, AttemptSummary } from "../models/attempt";
import { transformAttempt, transformAttemptSummary, transformFeedback, transformMessage } from "../mappers/attempt-mappers";

// Get all attempts for the current user
export async function getUserAttempts(): Promise<AttemptSummary[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("attempts")
      .select(
        "id, case_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, cases (title, category, difficulty, image_url)`",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attempts:", error);
      return [];
    }

    return data.map(transformAttemptSummary);
  } catch (error) {
    console.error("Unexpected error fetching attempts:", error);
    return [];
  }
}

// Get attempts for a specific case
export async function getAttemptsByCase(caseId: string): Promise<AttemptSummary[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("attempts")
      .select(
        "id, case_id, title, created_at, completed_at, completion_status, last_stage_index, time_spent_seconds, cases (title, category, difficulty, image_url)`",
      )
      .eq("user_id", user.id)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attempts for case:", error);
      return [];
    }

    return data.map(transformAttemptSummary);
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
  const { data: attemptData, error: attemptError } = await supabase.from("attempts").select("*").eq("id", attemptId).single();

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
  const { data, error } = await supabase.from("attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching attempts:", error);
    return [];
  }

  return data.map(transformAttempt);
}

// Get followups for a given attempt
export async function getFollowupsForAttempt(attemptId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.from("followups").select("*").eq("attempt_id", attemptId).order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching followups:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Unexpected error fetching followups:", err);
    return [];
  }
}

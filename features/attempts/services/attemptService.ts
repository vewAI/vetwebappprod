// /features/attempts/services/attemptService.ts
import { supabase } from "@/lib/supabase";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import type {
  Attempt,
  AttemptMessage,
  AttemptFeedback,
} from "../models/attempt";
import type { Message } from "@/features/chat/models/chat";

type DbAttempt = {
  id?: string;
  user_id?: string;
  case_id?: string;
  title?: string;
  created_at?: string;
  completed_at?: string | null;
  completion_status?: string;
  overall_feedback?: string | null;
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

// Create a new attempt
export async function createAttempt(caseId: string): Promise<Attempt | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return null;
    }

    // Use ISO timestamp for consistent server/client rendering and storage
    const title = `Attempt - ${new Date().toISOString()}`;

    const { data, error } = await supabase
      .from("attempts")
      .insert({
        user_id: user.id,
        case_id: caseId,
        title,
        last_stage_index: 0,
        completion_status: "in_progress",
        time_spent_seconds: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating attempt:", error);
      return null;
    }

    return transformAttempt(data);
  } catch (error) {
    console.error("Unexpected error creating attempt:", error);
    return null;
  }
}

// Save feedback for a stage
export async function saveFeedback(
  attemptId: string,
  stageIndex: number,
  feedbackContent: string
): Promise<boolean> {
  const { error } = await supabase.from("attempt_feedback").insert({
    attempt_id: attemptId,
    stage_index: stageIndex,
    feedback_content: feedbackContent,
  });

  if (error) {
    console.error("Error saving feedback:", error);
    return false;
  }

  return true;
}

// Mark an attempt as complete
export async function completeAttempt(
  attemptId: string,
  overallFeedback?: string
): Promise<boolean> {
  const { error } = await supabase
    .from("attempts")
    .update({
      completed_at: new Date().toISOString(),
      completion_status: "completed",
      overall_feedback: overallFeedback,
    })
    .eq("id", attemptId);

  if (error) {
    console.error("Error completing attempt:", error);
    return false;
  }

  return true;
}

// Get all attempts for the current user
export async function getUserAttempts(): Promise<Attempt[]> {
  try {
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return [];
    }

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
    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return [];
    }

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

  if (attemptError) {
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
    return {
      attempt: transformAttempt(attemptData),
      messages: [],
      feedback: [],
    };
  }

  // Get feedback
  const { data: feedbackData, error: feedbackError } = await supabase
    .from("attempt_feedback")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("stage_index", { ascending: true });

  if (feedbackError) {
    console.error("Error fetching feedback:", feedbackError);
    return {
      attempt: transformAttempt(attemptData),
      messages: messagesData.map(transformMessage),
      feedback: [],
    };
  }

  return {
    attempt: transformAttempt(attemptData),
    messages: messagesData.map(transformMessage),
    feedback: feedbackData.map(transformFeedback),
  };
}

// Delete an attempt
export async function deleteAttempt(attemptId: string): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error("Cannot delete attempt: missing auth token");
      return false;
    }
    // Call server-side API to delete attempt and related rows using service role key
    const resp = await fetch(
      `/api/attempts?id=${encodeURIComponent(attemptId)}`,
      {
        method: "DELETE",
        headers: await buildAuthHeaders({}, token),
      }
    );

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      console.error("Failed to delete attempt via API:", resp.status, body);
      return false;
    }

    const data = await resp.json().catch(() => ({}));
    if (data && data.success) return true;
    console.error("Delete attempt API returned unexpected body:", data);
    return false;
  } catch (err) {
    console.error("Error calling delete attempt API:", err);
    return false;
  }
}

// Save attempt progress
export async function saveAttemptProgress(
  attemptId: string,
  stageIndex: number,
  messages: Message[],
  timeSpentSeconds: number
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error("Cannot save attempt progress: missing auth token");
      return false;
    }
    const normalizedStageIndex = Number.isFinite(stageIndex)
      ? Math.max(0, Math.floor(stageIndex))
      : 0;
    const normalizedTime = Number.isFinite(timeSpentSeconds)
      ? Math.max(0, Math.floor(timeSpentSeconds))
      : 0;

    const response = await fetch("/api/attempts/progress", {
      method: "POST",
      headers: {
        ...(await buildAuthHeaders({ "Content-Type": "application/json" }, token)),
      },
      body: JSON.stringify({
        attemptId,
        stageIndex: normalizedStageIndex,
        timeSpentSeconds: normalizedTime,
        messages,
      }),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch (parseError) {
      if (response.ok) {
        console.error(
          "Attempt progress API returned a non-JSON response",
          parseError
        );
      }
    }

    if (!response.ok) {
      console.error(
        "Failed to save attempt progress via API:",
        response.status,
        body ?? {}
      );
      return false;
    }

    if (
      !body ||
      typeof body !== "object" ||
      !(body as { success?: boolean }).success
    ) {
      console.error("Attempt progress API returned unexpected body:", body);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error saving attempt progress:", error);
    return false;
  }
}

// Helper functions to transform database objects to our interfaces
function transformAttempt(data: DbAttempt): Attempt {
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
    lastStageIndex: Number(data.last_stage_index ?? 0),
    timeSpentSeconds: Number(data.time_spent_seconds ?? 0),
  };
}

function transformMessage(data: DbMessage): AttemptMessage {
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

function transformFeedback(data: DbFeedback): AttemptFeedback {
  return {
    id: data.id ?? "",
    attemptId: data.attempt_id ?? "",
    stageIndex: Number(data.stage_index ?? 0),
    feedbackContent: data.feedback_content ?? "",
    createdAt: data.created_at ?? "",
  };
}

import { supabase } from "@/lib/supabase";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import type { Attempt } from "../models/attempt";
import type { Message } from "@/features/chat/models/chat";
import { transformAttempt } from "../mappers/attempt-mappers";

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

// Create a follow-up record for a given attempt (Day 2, Day 3, etc.)
export async function createFollowup(
  attemptId: string,
  followupDay: number = 1,
  notes?: string
): Promise<{ success: boolean; followup?: any } | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error("createFollowup: no authenticated user");
      return null;
    }

    // Fetch attempt to get case id
    const { data: attemptData, error: attemptError } = await supabase
      .from("attempts")
      .select("id, case_id")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attemptData) {
      console.error("createFollowup: attempt not found", attemptError);
      return null;
    }

    const { data, error } = await supabase
      .from("followups")
      .insert({
        attempt_id: attemptId,
        case_id: attemptData.case_id,
        followup_day: followupDay,
        notes: notes ?? null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("createFollowup insert error:", error);
      return { success: false };
    }

    return { success: true, followup: data };
  } catch (err) {
    console.error("Unexpected error creating followup:", err);
    return null;
  }
}

// Update attempt time only (for fast-forward)
export async function updateAttemptTime(
  attemptId: string,
  timeSpentSeconds: number
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    const response = await fetch("/api/attempts/progress", {
      method: "POST",
      headers: {
        ...(await buildAuthHeaders(
          { "Content-Type": "application/json" },
          token
        )),
      },
      body: JSON.stringify({
        attemptId,
        timeSpentSeconds,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error("Error updating attempt time:", err);
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
        ...(await buildAuthHeaders(
          { "Content-Type": "application/json" },
          token
        )),
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

export async function updateProfessorFeedback(
  attemptId: string,
  feedback: string
): Promise<boolean> {
  const { error } = await supabase
    .from("attempts")
    .update({ professor_feedback: feedback })
    .eq("id", attemptId);

  if (error) {
    console.error("Error updating professor feedback:", error);
    return false;
  }
  return true;
}

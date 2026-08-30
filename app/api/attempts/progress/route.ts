import { NextResponse } from "next/server";
import type { Message } from "@/features/chat/models/chat";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";

type SaveProgressPayload = {
  attemptId?: string;
  stageIndex?: number;
  timeSpentSeconds?: number;
  messages?: Message[];
};

function coerceStageIndex(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

function coerceTimeSpent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.floor(numeric);
}

/*
type AttemptsTableUpdate = {
  last_stage_index: number;
  time_spent_seconds: number;
};
*/

type AttemptMessageRow = {
  attempt_id: string;
  role: string;
  content: string;
  timestamp: string;
  stage_index: number;
  display_role: string | null;
  persona_role_key: string | null;
  client_msg_id: string;
};

function mapMessagesToRows(
  attemptId: string,
  messages: Message[] | undefined
): AttemptMessageRow[] {
  if (!messages?.length) return [];

  return messages.map((msg) => {
    const stageIndex =
      typeof msg.stageIndex === "number" && Number.isFinite(msg.stageIndex)
        ? Math.floor(msg.stageIndex)
        : 0;
    const timestamp =
      typeof msg.timestamp === "string" && msg.timestamp.trim().length > 0
        ? msg.timestamp
        : new Date().toISOString();
    return {
      attempt_id: attemptId,
      role: msg.role ?? "system",
      content: msg.content ?? "",
      timestamp,
      stage_index: stageIndex,
      display_role: msg.displayRole ?? null,
      persona_role_key: msg.personaRoleKey ?? null,
      // Stable client id: enables idempotent upsert (no delete+reinsert).
      client_msg_id: msg.id,
    };
  });
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const body = (await req.json()) as SaveProgressPayload;

    if (!body?.attemptId) {
      return NextResponse.json(
        { error: "attemptId is required" },
        { status: 400 }
      );
    }

    const attemptId = body.attemptId;
    const access = await authorizeAttemptAccess(
      auth.adminSupabase ?? supabase,
      attemptId,
      auth.user.id,
      auth.role,
    );
    if (access.error) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }
    if (access.notFound) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Build update payload dynamically to allow partial updates
    const updatePayload: Record<string, unknown> = {};
    
    if (body.stageIndex !== undefined) {
      updatePayload.last_stage_index = coerceStageIndex(body.stageIndex);
    }
    
    if (body.timeSpentSeconds !== undefined) {
      updatePayload.time_spent_seconds = coerceTimeSpent(body.timeSpentSeconds);
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("attempts")
        .update(updatePayload)
        .eq("id", attemptId);

      if (updateError) {
        console.error("Attempt progress update failed", updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
    }

    const messageRows = mapMessagesToRows(attemptId, body.messages);

    // F4.1: Upsert every message keyed by (attempt_id, client_msg_id) and then
    // remove only the rows that are no longer part of the transcript. This
    // replaces the previous DELETE-all + reINSERT-all which rewrote the whole
    // transcript on every autosave (O(n²) churn + racing-tab interleaving).
    if (messageRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("attempt_messages")
        .upsert(messageRows, { onConflict: "attempt_id,client_msg_id" });

      if (upsertError) {
        console.error("Attempt progress failed while upserting messages", upsertError);
        return NextResponse.json(
          { error: upsertError.message ?? "Failed to save attempt messages" },
          { status: 500 }
        );
      }

      const clientIds = messageRows.map((row) => row.client_msg_id).filter(Boolean);
      const { error: cleanupError } = await supabase
        .from("attempt_messages")
        .delete()
        .eq("attempt_id", attemptId)
        .or(
          `client_msg_id.is.null,client_msg_id.not.in.(${clientIds.join(",")})`
        );

      if (cleanupError) {
        console.error("Attempt progress failed while pruning removed messages", cleanupError);
        return NextResponse.json(
          { error: cleanupError.message ?? "Failed to prune attempt messages" },
          { status: 500 }
        );
      }
    } else {
      // Empty transcript: clear the attempt's messages entirely.
      const { error: deleteError } = await supabase
        .from("attempt_messages")
        .delete()
        .eq("attempt_id", attemptId);

      if (deleteError) {
        console.error(
          "Attempt progress failed while clearing prior messages",
          deleteError
        );
        return NextResponse.json(
          { error: deleteError.message ?? "Failed to reset attempt messages" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("Attempt progress API threw", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { Message } from "@/features/chat/models/chat";
import { requireUser } from "@/app/api/_lib/auth";

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

type AttemptsTableUpdate = {
  last_stage_index: number;
  time_spent_seconds: number;
};

type AttemptMessageRow = {
  attempt_id: string;
  role: string;
  content: string;
  timestamp: string;
  stage_index: number;
  display_role: string | null;
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

    if (messageRows.length > 0) {
      const { error: insertError } = await supabase
        .from("attempt_messages")
        .insert(messageRows);

      if (insertError) {
        console.error("Attempt progress failed while inserting messages", insertError);
        return NextResponse.json(
          { error: insertError.message ?? "Failed to upsert attempt messages" },
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

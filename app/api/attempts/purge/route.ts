import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey
);

const CRON_TOKEN = process.env.ATTEMPT_PURGE_TOKEN ?? null;
const INCOMPLETE_TTL_HOURS = Number(
  process.env.ATTEMPT_INCOMPLETE_TTL_HOURS ?? 48
);
const COMPLETED_TTL_MONTHS = Number(
  process.env.ATTEMPT_COMPLETED_TTL_MONTHS ?? 6
);

const CHUNK_SIZE = 100;

export const runtime = "nodejs";

async function handlePurge(req: NextRequest): Promise<NextResponse> {
  if (CRON_TOKEN) {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${CRON_TOKEN}`;
    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const incompleteCutoff = new Date(now.getTime());
  incompleteCutoff.setHours(incompleteCutoff.getHours() - INCOMPLETE_TTL_HOURS);

  const completedCutoff = new Date(now.getTime());
  completedCutoff.setMonth(
    completedCutoff.getMonth() - Math.max(0, COMPLETED_TTL_MONTHS)
  );

  const incompleteIso = incompleteCutoff.toISOString();
  const completedIso = completedCutoff.toISOString();

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const { data: staleIncomplete, error: staleError } = await supabase
    .from("attempts")
    .select("id")
    .in("completion_status", ["in_progress", "abandoned"])
    .lt("created_at", incompleteIso);

  if (staleError) {
    console.error("Failed to select stale incomplete attempts", staleError);
    return NextResponse.json(
      { error: "Failed to select stale incomplete attempts" },
      { status: 500 }
    );
  }

  const { data: oldCompleted, error: completedError } = await supabase
    .from("attempts")
    .select("id")
    .eq("completion_status", "completed")
    .not("completed_at", "is", null)
    .lt("completed_at", completedIso);

  if (completedError) {
    console.error("Failed to select old completed attempts", completedError);
    return NextResponse.json(
      { error: "Failed to select old completed attempts" },
      { status: 500 }
    );
  }

  const { data: oldCompletedNoTimestamp, error: completedFallbackError } =
    await supabase
      .from("attempts")
      .select("id")
      .eq("completion_status", "completed")
      .is("completed_at", null)
      .lt("created_at", completedIso);

  if (completedFallbackError) {
    console.error(
      "Failed to select completed attempts lacking timestamps",
      completedFallbackError
    );
    return NextResponse.json(
      { error: "Failed to select completed attempts lacking timestamps" },
      { status: 500 }
    );
  }

  const staleIds = (staleIncomplete ?? []).map((row) => row.id).filter(Boolean);
  const oldCompletedIds = (oldCompleted ?? [])
    .map((row) => row.id)
    .filter(Boolean);
  const oldCompletedFallbackIds = (oldCompletedNoTimestamp ?? [])
    .map((row) => row.id)
    .filter(Boolean);
  const candidates = Array.from(
    new Set([...staleIds, ...oldCompletedIds, ...oldCompletedFallbackIds])
  );

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      staleIncompleteCount: staleIds.length,
      completedExpiredCount: oldCompletedIds.length,
      completedExpiredFallbackCount: oldCompletedFallbackIds.length,
      totalCandidates: candidates.length,
      incompleteCutoff: incompleteIso,
      completedCutoff: completedIso,
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      staleIncompleteCount: staleIds.length,
      completedExpiredCount: oldCompletedIds.length,
      completedExpiredFallbackCount: oldCompletedFallbackIds.length,
      totalDeleted: 0,
    });
  }

  let messagesDeleted = 0;
  let feedbackDeleted = 0;
  let attemptsDeleted = 0;

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);

    const { data: deletedMessages, error: msgError } = await supabase
      .from("attempt_messages")
      .delete()
      .in("attempt_id", chunk)
      .select("id");

    if (msgError) {
      console.error("Failed to delete attempt_messages chunk", msgError);
      return NextResponse.json(
        { error: "Failed to delete attempt messages" },
        { status: 500 }
      );
    }
    messagesDeleted += deletedMessages?.length ?? 0;

    const { data: deletedFeedback, error: fbError } = await supabase
      .from("attempt_feedback")
      .delete()
      .in("attempt_id", chunk)
      .select("id");

    if (fbError) {
      console.error("Failed to delete attempt_feedback chunk", fbError);
      return NextResponse.json(
        { error: "Failed to delete attempt feedback" },
        { status: 500 }
      );
    }
    feedbackDeleted += deletedFeedback?.length ?? 0;

    const { data: deletedAttempts, error: attemptsError } = await supabase
      .from("attempts")
      .delete()
      .in("id", chunk)
      .select("id");

    if (attemptsError) {
      console.error("Failed to delete attempts chunk", attemptsError);
      return NextResponse.json(
        { error: "Failed to delete attempts" },
        { status: 500 }
      );
    }
    attemptsDeleted += deletedAttempts?.length ?? 0;
  }

  return NextResponse.json({
    staleIncompleteCount: staleIds.length,
    completedExpiredCount: oldCompletedIds.length,
    completedExpiredFallbackCount: oldCompletedFallbackIds.length,
    attemptsDeleted,
    messagesDeleted,
    feedbackDeleted,
  });
}

export async function GET(req: NextRequest) {
  return handlePurge(req);
}

export async function POST(req: NextRequest) {
  return handlePurge(req);
}

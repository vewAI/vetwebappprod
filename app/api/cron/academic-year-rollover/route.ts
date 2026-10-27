import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const CRON_TOKEN = process.env.CRON_SECRET ?? null;

function londonMonthDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { month, day };
}

async function handleRollover(request: NextRequest) {
  if (!CRON_TOKEN) {
    return NextResponse.json({ error: "Rollover service is not configured" }, { status: 503 });
  }

  const expected = `Bearer ${CRON_TOKEN}`;
  if (request.headers.get("authorization") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const today = londonMonthDay();
  const { data: institutions, error: instError } = await db
    .from("institutions")
    .select("id, academic_year_end_month, academic_year_end_day");
  if (instError) {
    return NextResponse.json({ error: instError.message }, { status: 500 });
  }

  const matchingIds = (institutions ?? [])
    .filter((institution) => {
      const month = Number(institution.academic_year_end_month ?? 7);
      const day = Number(institution.academic_year_end_day ?? 31);
      return month === today.month && day === today.day;
    })
    .map((institution) => institution.id as string);

  if (matchingIds.length === 0) {
    return NextResponse.json({
      ok: true,
      month: today.month,
      day: today.day,
      institutionsMatched: 0,
      studentsUnassigned: 0,
    });
  }

  const { data: updated, error: updateError } = await db
    .from("profiles")
    .update({ year_group_id: null })
    .in("institution_id", matchingIds)
    .eq("role", "student")
    .not("year_group_id", "is", null)
    .select("user_id");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    month: today.month,
    day: today.day,
    institutionsMatched: matchingIds.length,
    studentsUnassigned: updated?.length ?? 0,
  });
}

export async function GET(request: NextRequest) {
  return handleRollover(request);
}

export async function POST(request: NextRequest) {
  return handleRollover(request);
}

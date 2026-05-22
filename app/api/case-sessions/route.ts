import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import {
  mapRowToCaseSession,
  matchesSessionStatusFilter,
  normalizeAccessCode,
  type CaseSessionDbRow,
} from "@/app/api/_lib/caseSessions";
import type { SessionStatus } from "@/features/case-sessions/models/caseSession";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId") ?? undefined;
  const statusParam = url.searchParams.get("status") ?? "all";
  const mine = url.searchParams.get("mine") === "true";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const supabase = auth.adminSupabase ?? auth.supabase;

  let query = supabase
    .from("case_sessions")
    .select(
      "id, case_id, created_by, name, friendly_name, description, access_code, start_at, end_at, attempt_limit_per_student, created_at, updated_at, cases(id, title, species, difficulty, image_url)"
    )
    .order("start_at", { ascending: false });

  if (caseId) {
    query = query.eq("case_id", caseId);
  }

  if (mine) {
    query = query.eq("created_by", auth.user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("GET /api/case-sessions", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = (data ?? []) as CaseSessionDbRow[];

  if (statusParam !== "all" && ["scheduled", "active", "completed"].includes(statusParam)) {
    rows = rows.filter((r) =>
      matchesSessionStatusFilter(r, statusParam as SessionStatus)
    );
  }

  if (q) {
    rows = rows.filter((r) => {
      const s = mapRowToCaseSession(r);
      const hay = [
        s.name,
        s.friendlyName,
        s.description,
        s.case?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return NextResponse.json({
    sessions: rows.map(mapRowToCaseSession),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const friendlyName =
    typeof body.friendlyName === "string" ? body.friendlyName.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt : "";
  const endAt = typeof body.endAt === "string" ? body.endAt : "";
  const accessCode = normalizeAccessCode(
    typeof body.accessCode === "string" ? body.accessCode : null
  );
  const attemptLimitPerStudent =
    body.attemptLimitPerStudent == null || body.attemptLimitPerStudent === ""
      ? null
      : Number(body.attemptLimitPerStudent);

  if (!caseId || !name || !friendlyName || !startAt || !endAt) {
    return NextResponse.json(
      { error: "caseId, name, friendlyName, startAt, and endAt are required" },
      { status: 400 }
    );
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json(
      { error: "endAt must be after startAt" },
      { status: 400 }
    );
  }

  const now = new Date();
  if (start < now) {
    return NextResponse.json(
      { error: "startAt must be in the future" },
      { status: 400 }
    );
  }

  if (
    attemptLimitPerStudent != null &&
    (!Number.isFinite(attemptLimitPerStudent) ||
      attemptLimitPerStudent < 1 ||
      !Number.isInteger(attemptLimitPerStudent))
  ) {
    return NextResponse.json(
      { error: "attemptLimitPerStudent must be a positive integer or omitted" },
      { status: 400 }
    );
  }

  const supabase = auth.adminSupabase ?? auth.supabase;

  const { data, error } = await supabase
    .from("case_sessions")
    .insert({
      case_id: caseId,
      created_by: auth.user.id,
      name,
      friendly_name: friendlyName,
      description,
      access_code: accessCode,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      attempt_limit_per_student: attemptLimitPerStudent,
    })
    .select(
      "id, case_id, created_by, name, friendly_name, description, access_code, start_at, end_at, attempt_limit_per_student, created_at, updated_at, cases(id, title, species, difficulty, image_url)"
    )
    .single();

  if (error) {
    console.error("POST /api/case-sessions", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: mapRowToCaseSession(data as CaseSessionDbRow),
  });
}

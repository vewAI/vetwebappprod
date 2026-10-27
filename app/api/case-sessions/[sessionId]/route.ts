import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/app/api/_lib/auth";
import {
  CASE_SESSION_SELECT,
  fetchCaseSessionRow,
  fetchProfileYearGroup,
  mapRowToCaseSession,
  normalizeAccessCode,
  studentCanAccessSession,
  type CaseSessionDbRow,
} from "@/app/api/_lib/caseSessions";

type RouteContext = { params: Promise<{ sessionId: string }> };

async function resolveCreatorLabel(supabase: SupabaseClient, createdBy: string): Promise<string | undefined> {
  const { data: byUserId } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", createdBy)
    .maybeSingle();
  const fromUserId = byUserId?.full_name?.trim() || byUserId?.email?.trim();
  if (fromUserId) return fromUserId;

  const { data: byId } = await supabase.from("profiles").select("full_name, email").eq("id", createdBy).maybeSingle();
  const fromId = byId?.full_name?.trim() || byId?.email?.trim();
  if (fromId) return fromId;

  const { data: authUser } = await supabase.auth.admin.getUserById(createdBy);
  const metaName =
    typeof authUser.user?.user_metadata?.full_name === "string" ? authUser.user.user_metadata.full_name.trim() : "";
  return metaName || authUser.user?.email || undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await context.params;
  const supabase = auth.adminSupabase ?? auth.supabase;
  const { data, error } = await fetchCaseSessionRow(supabase, sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = mapRowToCaseSession(data);
  if (auth.role === "student") {
    const profile = await fetchProfileYearGroup(supabase, auth.user.id);
    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 500 });
    }
    if (!studentCanAccessSession(auth.role, profile.yearGroupId, session.yearGroupId)) {
      return NextResponse.json({ error: "This session is not available for your year group" }, { status: 403 });
    }
  }
  session.createdByName = await resolveCreatorLabel(auth.adminSupabase ?? supabase, data.created_by);

  return NextResponse.json({ session });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await context.params;
  const supabase = auth.adminSupabase ?? auth.supabase;

  const { data: existing, error: loadErr } = await fetchCaseSessionRow(
    supabase,
    sessionId
  );
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (auth.role !== "admin" && existing.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.friendlyName === "string")
    patch.friendly_name = body.friendlyName.trim();
  if (typeof body.description === "string")
    patch.description = body.description.trim();
  if ("accessCode" in body) {
    patch.access_code = normalizeAccessCode(
      typeof body.accessCode === "string" ? body.accessCode : null
    );
  }
  if (typeof body.startAt === "string") patch.start_at = body.startAt;
  if (typeof body.endAt === "string") patch.end_at = body.endAt;
  if ("attemptLimitPerStudent" in body) {
    if (body.attemptLimitPerStudent == null || body.attemptLimitPerStudent === "") {
      patch.attempt_limit_per_student = null;
    } else {
      const n = Number(body.attemptLimitPerStudent);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json(
          { error: "attemptLimitPerStudent must be a positive integer or null" },
          { status: 400 }
        );
      }
      patch.attempt_limit_per_student = n;
    }
  }

  if (patch.start_at != null || patch.end_at != null) {
    const start = new Date(
      (patch.start_at as string) ?? existing.start_at
    );
    const end = new Date((patch.end_at as string) ?? existing.end_at);
    if (end <= start) {
      return NextResponse.json(
        { error: "endAt must be after startAt" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("case_sessions")
    .update(patch)
    .eq("id", sessionId)
    .select(CASE_SESSION_SELECT)
    .single();

  if (error) {
    console.error("PATCH /api/case-sessions/[sessionId]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    session: mapRowToCaseSession(data as unknown as CaseSessionDbRow),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const { sessionId } = await context.params;
  const supabase = auth.adminSupabase ?? auth.supabase;

  const { data: existing, error: loadErr } = await fetchCaseSessionRow(
    supabase,
    sessionId
  );
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (auth.role !== "admin" && existing.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("case_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

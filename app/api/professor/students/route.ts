import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { ProfessorStudentRow } from "@/features/professor/models/student";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SELECT_WITH_YEAR = "user_id, email, created_at, year_group_id, year_groups!year_group_id(id, name)";
const SELECT_FALLBACK = "user_id, email, created_at, year_group_id";

type StudentSort = "email" | "joined";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSort(value: string | null): StudentSort {
  return value === "joined" ? "joined" : "email";
}

function parseDir(value: string | null): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc";
}

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function mapRows(rows: Record<string, unknown>[] | null, yearNameById: Map<string, string>): ProfessorStudentRow[] {
  return (rows ?? []).map((row) => {
    const yearGroupsJoin = row.year_groups as { id?: string; name?: string } | { id?: string; name?: string }[] | null | undefined;
    const yearGroup = Array.isArray(yearGroupsJoin) ? yearGroupsJoin[0] : yearGroupsJoin;
    const yearGroupId = typeof row.year_group_id === "string" ? row.year_group_id : null;
    const yearGroupName =
      (typeof yearGroup?.name === "string" && yearGroup.name) || (yearGroupId ? yearNameById.get(yearGroupId) ?? null : null);
    return {
      userId: String(row.user_id),
      email: typeof row.email === "string" ? row.email : "",
      yearGroupId,
      yearGroupName,
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      lastSignInAt: null,
    };
  });
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (auth.role !== "professor" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = getSupabaseAdminClient() ?? auth.adminSupabase;
  if (!adminClient) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE));
  const email = url.searchParams.get("email")?.trim() ?? "";
  const yearGroupId = url.searchParams.get("yearGroupId")?.trim() || "all";
  const sort = parseSort(url.searchParams.get("sort"));
  const dir = parseDir(url.searchParams.get("dir"));
  const ascending = dir === "asc";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let institutionId: string | null = null;
  if (auth.role !== "admin") {
    const { data: professorProfile, error: professorError } = await adminClient
      .from("profiles")
      .select("institution_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (professorError) {
      return NextResponse.json({ error: professorError.message }, { status: 500 });
    }
    institutionId = professorProfile?.institution_id ?? null;
    if (!institutionId) {
      return NextResponse.json({ students: [] as ProfessorStudentRow[], total: 0, page, pageSize });
    }
  }

  const applyFilters = (query: any) => {
    let next = query.or("role.eq.student,role.is.null");
    if (institutionId) next = next.eq("institution_id", institutionId);
    if (email) next = next.ilike("email", `%${escapeIlike(email)}%`);
    if (yearGroupId === "unassigned") next = next.is("year_group_id", null);
    else if (yearGroupId !== "all") next = next.eq("year_group_id", yearGroupId);
    return next;
  };

  const applyOrder = (query: any) => {
    if (sort === "joined") return query.order("created_at", { ascending });
    return query.order("email", { ascending });
  };

  let query = applyOrder(applyFilters(adminClient.from("profiles").select(SELECT_WITH_YEAR, { count: "exact" })));
  let { data, error, count } = await query.range(from, to);
  if (error) {
    const fallback = applyOrder(applyFilters(adminClient.from("profiles").select(SELECT_FALLBACK, { count: "exact" })));
    const retry = await fallback.range(from, to);
    data = retry.data as typeof data;
    error = retry.error;
    count = retry.count;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const yearGroupIds = [
    ...new Set(
      rows
        .map((row) => (typeof row.year_group_id === "string" ? row.year_group_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const yearNameById = new Map<string, string>();
  if (yearGroupIds.length > 0) {
    const { data: yearGroups } = await adminClient.from("year_groups").select("id, name").in("id", yearGroupIds);
    for (const group of yearGroups ?? []) {
      yearNameById.set(group.id as string, group.name as string);
    }
  }

  return NextResponse.json({
    students: mapRows(rows, yearNameById),
    total: count ?? 0,
    page,
    pageSize,
  });
}

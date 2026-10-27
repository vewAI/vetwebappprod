import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";
import { deriveStatus, type SessionStatus } from "@/features/case-sessions/models/caseSession";

export type CaseSessionDbRow = {
  id: string;
  case_id: string;
  created_by: string;
  name: string;
  friendly_name: string;
  description: string | null;
  access_code: string | null;
  start_at: string;
  end_at: string;
  attempt_limit_per_student: number | null;
  year_group_id: string | null;
  created_at: string;
  updated_at: string;
  year_groups?: {
    id: string;
    name: string;
  } | null;
  cases?: {
    id: string;
    title: string;
    species: string | null;
    difficulty: string | null;
    image_url: string | null;
    description: string | null;
    category: string | null;
  } | null;
};

export const CASE_SESSION_SELECT =
  "id, case_id, created_by, name, friendly_name, description, access_code, start_at, end_at, attempt_limit_per_student, year_group_id, created_at, updated_at, year_groups(id, name), cases(id, title, species, difficulty, image_url, description, category)";

export function mapRowToCaseSession(row: CaseSessionDbRow): CaseSession {
  const c = row.cases;
  const yearGroup = Array.isArray(row.year_groups) ? row.year_groups[0] : row.year_groups;
  return {
    id: row.id,
    caseId: row.case_id,
    createdBy: row.created_by,
    name: row.name,
    friendlyName: row.friendly_name,
    description: row.description ?? "",
    accessCode: row.access_code,
    startAt: row.start_at,
    endAt: row.end_at,
    attemptLimitPerStudent: row.attempt_limit_per_student,
    yearGroupId: row.year_group_id ?? null,
    yearGroupName: yearGroup?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    case: c
      ? {
          id: c.id,
          title: c.title,
          species: c.species ?? "",
          difficulty: c.difficulty ?? "",
          imageUrl: c.image_url ?? "",
          description: c.description ?? "",
          category: c.category ?? "",
        }
      : undefined,
  };
}

export async function attachCreatorNames(
  supabase: SupabaseClient,
  sessions: CaseSession[]
): Promise<CaseSession[]> {
  const ids = [...new Set(sessions.map((session) => session.createdBy).filter(Boolean))];
  if (ids.length === 0) return sessions;

  const [{ data: byUserId }, { data: byId }] = await Promise.all([
    supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids),
    supabase.from("profiles").select("id, full_name, email").in("id", ids),
  ]);

  const names = new Map<string, string>();
  for (const row of byUserId ?? []) {
    const label = row.full_name?.trim() || row.email?.trim();
    if (row.user_id && label) names.set(row.user_id, label);
  }
  for (const row of byId ?? []) {
    const label = row.full_name?.trim() || row.email?.trim();
    if (row.id && label && !names.has(row.id)) names.set(row.id, label);
  }

  return sessions.map((session) => ({
    ...session,
    createdByName: names.get(session.createdBy) ?? session.createdByName,
  }));
}

export function matchesSessionStatusFilter(
  row: CaseSessionDbRow,
  status: SessionStatus
): boolean {
  const s = mapRowToCaseSession(row);
  return deriveStatus(s) === status;
}

export function normalizeAccessCode(code: string | null | undefined): string | null {
  if (code == null || typeof code !== "string") return null;
  const t = code.trim();
  return t.length === 0 ? null : t;
}

export function studentCanAccessSession(
  role: string | null | undefined,
  studentYearGroupId: string | null | undefined,
  sessionYearGroupId: string | null | undefined
): boolean {
  if (role !== "student") return true;
  if (!studentYearGroupId || !sessionYearGroupId) return false;
  return studentYearGroupId === sessionYearGroupId;
}

export async function fetchProfileYearGroup(
  supabase: SupabaseClient,
  userId: string
): Promise<{ role: string | null; yearGroupId: string | null; institutionId: string | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, year_group_id, institution_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return { role: null, yearGroupId: null, institutionId: null, error: { message: error.message } };
  }
  return {
    role: data?.role ?? null,
    yearGroupId: data?.year_group_id ?? null,
    institutionId: data?.institution_id ?? null,
    error: null,
  };
}

export function accessCodesMatch(
  stored: string | null | undefined,
  provided: string | null | undefined
): boolean {
  const s = normalizeAccessCode(stored);
  const p = normalizeAccessCode(provided ?? "");
  if (s === null) return true;
  if (p === null) return false;
  return s.toLowerCase() === p.toLowerCase();
}

export async function fetchCaseSessionRow(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ data: CaseSessionDbRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("case_sessions")
    .select(CASE_SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data as CaseSessionDbRow | null, error: null };
}

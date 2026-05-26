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
  created_at: string;
  updated_at: string;
  cases?: {
    id: string;
    title: string;
    species: string | null;
    difficulty: string | null;
    image_url: string | null;
  } | null;
};

export function mapRowToCaseSession(row: CaseSessionDbRow): CaseSession {
  const c = row.cases;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    case: c
      ? {
          id: c.id,
          title: c.title,
          species: c.species ?? "",
          difficulty: c.difficulty ?? "",
          imageUrl: c.image_url ?? "",
        }
      : undefined,
  };
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
    .select(
      "id, case_id, created_by, name, friendly_name, description, access_code, start_at, end_at, attempt_limit_per_student, created_at, updated_at, cases(id, title, species, difficulty, image_url)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  return { data: data as CaseSessionDbRow | null, error: null };
}

import type { SupabaseClient } from "@supabase/supabase-js";

type AttemptOwnerRow = {
  id: string;
  user_id: string;
  case_id?: string;
};

type AccessResult = {
  allowed: boolean;
  notFound?: boolean;
  error?: string;
  attempt?: AttemptOwnerRow;
};

/**
 * Check access using the service-role client before a route performs a
 * privileged read or write. Database policies remain important, but route
 * handlers must not rely on permissive/legacy policies for object ownership.
 */
export async function authorizeAttemptAccess(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  role: string | null,
  options: { allowProfessorRead?: boolean } = {},
): Promise<AccessResult> {
  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, user_id, case_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) return { allowed: false, error: attemptError.message };
  if (!attempt) return { allowed: false, notFound: true };

  const owner = attempt as AttemptOwnerRow;
  if (role === "admin" || owner.user_id === userId) {
    return { allowed: true, attempt: owner };
  }

  if (role === "professor" && options.allowProfessorRead) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("professor_students")
      .select("student_id")
      .eq("professor_id", userId)
      .eq("student_id", owner.user_id)
      .maybeSingle();

    if (assignmentError) {
      return { allowed: false, error: assignmentError.message };
    }
    if (assignment) return { allowed: true, attempt: owner };
  }

  return { allowed: false };
}

export async function authorizeProfessorStudent(
  supabase: SupabaseClient,
  professorId: string,
  studentId: string,
): Promise<{ allowed: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("professor_students")
    .select("student_id")
    .eq("professor_id", professorId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) return { allowed: false, error: error.message };
  return { allowed: Boolean(data) };
}

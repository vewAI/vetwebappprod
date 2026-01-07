import { supabase } from "@/lib/supabase";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import { ProfessorCase, ProfessorStudent } from "../models/types";

export const professorService = {
  async getProfessorCases(professorId: string) {
    const { data, error } = await supabase
      .from("professor_cases")
      .select(`
        *,
        case:cases (
          id,
          title,
          description,
          difficulty,
          species,
          image_url
        )
      `)
      .eq("professor_id", professorId);

    if (error) throw error;
    return data;
  },

  async assignCaseToProfessor(professorId: string, caseId: string) {
    const { data, error } = await supabase
      .from("professor_cases")
      .insert({ professor_id: professorId, case_id: caseId })
      .select()
      .single();

    if (error) throw error;
    return data as ProfessorCase;
  },

  async removeCaseFromProfessor(professorId: string, caseId: string) {
    const { error } = await supabase
      .from("professor_cases")
      .delete()
      .match({ professor_id: professorId, case_id: caseId });

    if (error) throw error;
  },

  async getProfessorStudents(professorId: string) {
    // Fetch relationships first
    const { data: relations, error: relError } = await supabase
      .from("professor_students")
      .select("*")
      .eq("professor_id", professorId);

    if (relError) throw relError;
    if (!relations || relations.length === 0) return [];

    // Fetch profiles for the students
    const studentIds = relations.map((r) => r.student_id);
    const { data: profiles, error: profError } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name, avatar_url") // Ensure user_id is selected for matching
      .in("user_id", studentIds);

    if (profError) throw profError;

    // Merge data manually since foreign key might be missing in schema cache
    return relations.map((rel) => ({
      ...rel,
      student: profiles?.find((p) => p.user_id === rel.student_id) || null,
    }));
  },

  async createStudent(professorId: string, studentData: { email: string; password: string; fullName: string; institutionId?: string }) {
    // 1. Create the user via Admin API
    const token = await getAccessToken();
    const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, token);

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...studentData,
        role: 'student',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create student');
    }

    const { user } = await response.json();

    // 2. Link to professor
    const { error: linkError } = await supabase
      .from("professor_students")
      .insert({
        professor_id: professorId,
        student_id: user.id
      });

    if (linkError) {
      // If linking fails, we might want to warn the user, but the account is created.
      // Ideally we should rollback, but we can't easily rollback the API call.
      // For now, throw error so UI knows something went wrong.
      throw new Error(`Student created but failed to link to professor: ${linkError.message}`);
    }

    return user;
  },

  // Feedback APIs
  async getFeedbackForStudent(studentId: string) {
    const { data, error } = await supabase
      .from('professor_feedback')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async postFeedback(professorId: string, studentId: string, message: string, meta?: Record<string, unknown>) {
    const payload: any = {
      professor_id: professorId,
      student_id: studentId,
      message,
      metadata: meta || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('professor_feedback').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  // Case assignment to student
  async assignCaseToStudent(professorId: string, studentId: string, caseId: string) {
    // Accept any caseId string — DB column type should control allowed values.
    const { data, error } = await supabase
      .from('professor_assigned_cases')
      .insert({ professor_id: professorId, student_id: studentId, case_id: caseId, assigned_at: new Date().toISOString() })
      .select()
      .single();

    // Supabase may return an empty error object in some environments; validate
    // the response and throw a clear error when no row is returned.
    if (error && Object.keys(error).length > 0) {
      throw error;
    }

    if (!data) {
      throw new Error('Assignment failed: no row returned from database');
    }

    // Try to set owner_id on the case (server-side) so RLS policies that
    // depend on owner_id work correctly. This calls a server route that
    // updates the case using the service role key.
    try {
      const token = await getAccessToken();
      const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, token);
      // best-effort: don't fail the assignment if this call fails
      void fetch('/api/professor/set-case-owner', {
        method: 'POST',
        headers,
        body: JSON.stringify({ caseId, ownerId: professorId }),
      }).catch((e) => console.warn('set-case-owner call failed', e));
    } catch (e) {
      console.warn('Unable to call set-case-owner route:', e);
    }

    return data;
  },

  async getAssignedCasesForStudent(studentId: string) {
    // Avoid PostgREST FK join requirement by doing a manual join in code.
    const { data: assignments, error } = await supabase
      .from('professor_assigned_cases')
      .select('id, professor_id, student_id, case_id, assigned_at')
      .eq('student_id', studentId)
      .order('assigned_at', { ascending: false });

    if (error && Object.keys(error).length > 0) throw error;
    if (!assignments || assignments.length === 0) return [];

    const caseIds = Array.from(new Set(assignments.map(a => a.case_id).filter(Boolean)));
    if (caseIds.length === 0) return assignments.map(a => ({ ...a, case: null }));

    const { data: cases, error: casesErr } = await supabase
      .from('cases')
      .select('id, title, difficulty, species, image_url')
      .in('id', caseIds);

    if (casesErr && Object.keys(casesErr).length > 0) throw casesErr;
    const caseMap = new Map<string, any>((cases || []).map((c: any) => [c.id, c]));

    return assignments.map((a: any) => ({
      ...a,
      case: caseMap.get(a.case_id) || null,
    }));
  },

  async getClassStats(professorId: string) {
    // 1. Get all students
    const { data: relations } = await supabase
      .from("professor_students")
      .select("student_id")
      .eq("professor_id", professorId);
    
    if (!relations || relations.length === 0) return null;
    const studentIds = relations.map(r => r.student_id);

    // 2. Get all attempts for these students
    const { data: attempts, error } = await supabase
      .from("attempts")
      .select("id, completion_status, time_spent_seconds, created_at")
      .in("user_id", studentIds);

    if (error) throw error;

    // 3. Calculate stats
    const totalAttempts = attempts.length;
    const completedAttempts = attempts.filter(a => a.completion_status === 'completed').length;
    const completionRate = totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;
    
    const totalTime = attempts.reduce((acc, curr) => acc + (curr.time_spent_seconds || 0), 0);
    const avgTime = totalAttempts > 0 ? totalTime / totalAttempts : 0;

    return {
      totalAttempts,
      completedAttempts,
      completionRate,
      avgTime
    };
  }
};

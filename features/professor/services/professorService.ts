import { supabase } from "@/lib/supabase";
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
  }
};

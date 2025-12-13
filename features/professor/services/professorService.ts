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
    // This assumes we can join with profiles or auth.users. 
    // Since auth.users is not directly accessible via simple join usually without a view or specific setup,
    // we might need to rely on a public profiles table if it exists.
    // Based on the migration script, we have 'professor_students' linking to 'auth.users'.
    // We usually have a 'profiles' table that mirrors users for public info.
    
    const { data, error } = await supabase
      .from("professor_students")
      .select(`
        *,
        student:profiles!student_id (
          id,
          email,
          full_name,
          avatar_url
        )
      `)
      .eq("professor_id", professorId);

    if (error) throw error;
    return data;
  }
};

import { createClient } from "@supabase/supabase-js";
import type { Case } from "../models/case";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchCases(): Promise<Case[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapDbCaseToCase);
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data ? mapDbCaseToCase(data) : null;
}

function mapDbCaseToCase(dbCase: any): Case {
  return {
    id: dbCase.id,
    title: dbCase.title,
    description: dbCase.description,
    species: dbCase.species,
    condition: dbCase.condition,
    category: dbCase.category,
    difficulty: dbCase.difficulty,
    estimatedTime: dbCase.estimated_time,
    imageUrl: dbCase.image_url,
  };
}

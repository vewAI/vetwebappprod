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
  // Try exact match first
  try {
    let { data } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .single();
    if (data) return mapDbCaseToCase(data);

    // Next try a slug column (if you have one) so URLs like /test-case-2 work
    const { data: bySlug } = await supabase
      .from("cases")
      .select("*")
      .eq("slug", id)
      .single();
    if (bySlug) return mapDbCaseToCase(bySlug);

    // Fallback: try prefix match on id (helps when DB ids include suffixes)
    const { data: prefixMatch } = await supabase
      .from("cases")
      .select("*")
      .ilike("id", `${id}%`)
      .limit(1);
    if (prefixMatch && prefixMatch.length > 0)
      return mapDbCaseToCase(prefixMatch[0]);

    return null;
  } catch (e) {
    // On any error, return null (page will show notFound). Consider logging during debugging.
    console.error("fetchCaseById error:", e);
    return null;
  }
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

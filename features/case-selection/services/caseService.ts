import { supabase } from "@/lib/supabase";
import type { Case } from "../models/case";
import { normalizeCaseMedia } from "@/features/cases/models/caseMedia";

// Use shared singleton Supabase client to avoid multiple GoTrue instances

type DbCase = {
  id?: string;
  title?: string;
  description?: string | null;
  species?: string | null;
  condition?: string | null;
  category?: string | null;
  difficulty?: string | null;
  estimated_time?: number | string | null;
  image_url?: string | null;
  gif_url?: string | null;
  tags?: string[] | null;
  is_published?: boolean | null;
  media?: unknown;
};

export type FetchCasesOptions = {
  limit?: number;
  offset?: number;
  tags?: string[];
  difficulty?: string;
  species?: string;
  category?: string; // Added category/discipline
  search?: string;
  includeUnpublished?: boolean;
};

export async function fetchCases(
  options: FetchCasesOptions = {}
): Promise<Case[]> {
  let query = supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: true });

  if (!options.includeUnpublished) {
    query = query.eq("is_published", true);
  }

  if (options.category) {
    query = query.eq("category", options.category);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  if (options.offset) {
    const from = options.offset;
    const to = from + (options.limit || 10) - 1;
    query = query.range(from, to);
  }

  if (options.difficulty) {
    query = query.eq("difficulty", options.difficulty);
  }

  if (options.species) {
    query = query.eq("species", options.species);
  }

  if (options.tags && options.tags.length > 0) {
    query = query.contains("tags", options.tags);
  }

  if (options.search) {
    query = query.or(
      `title.ilike.%${options.search}%,description.ilike.%${options.search}%`
    );
  }

  const { data, error } = await query;
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

export async function fetchDisciplines(): Promise<string[]> {
  try {
    // Try to fetch from 'disciplines' table first
    const { data, error } = await supabase.from("disciplines").select("name");
    if (!error && data) {
      return data.map((d) => d.name).sort();
    }

    // Fallback: fetch distinct categories from cases
    const { data: cases } = await supabase.from("cases").select("category");
    if (cases) {
      const categories = new Set(cases.map((c) => c.category).filter(Boolean));
      return Array.from(categories).sort() as string[];
    }
    return [];
  } catch (e) {
    console.error("Failed to fetch disciplines", e);
    return [];
  }
}

export async function fetchAssignedCases(userId: string): Promise<Case[]> {
  // 1. Get professors for this student
  const { data: professors } = await supabase
    .from("professor_students")
    .select("professor_id")
    .eq("student_id", userId);

  if (!professors || professors.length === 0) return [];

  const professorIds = professors.map((p) => p.professor_id);

  // 2. Get cases assigned by these professors
  const { data: assignedCases } = await supabase
    .from("professor_cases")
    .select("case_id")
    .in("professor_id", professorIds);

  if (!assignedCases || assignedCases.length === 0) return [];

  const caseIds = assignedCases.map((c) => c.case_id);

  // 3. Fetch case details
  const { data: cases } = await supabase
    .from("cases")
    .select("*")
    .in("id", caseIds);

  return (cases ?? []).map(mapDbCaseToCase);
}

export function mapDbCaseToCase(dbCase: DbCase): Case {
  return {
    id: dbCase.id ?? "",
    title: dbCase.title ?? "",
    description: dbCase.description ?? "",
    species: dbCase.species ?? "",
    condition: dbCase.condition ?? "",
    category: dbCase.category ?? "",
    difficulty: (() => {
      const d = String(dbCase.difficulty ?? "");
      if (d === "Hard") return "Hard" as const;
      if (d === "Medium") return "Medium" as const;
      return "Easy" as const;
    })(),
    estimatedTime:
      typeof dbCase.estimated_time === "number"
        ? dbCase.estimated_time
        : Number(dbCase.estimated_time || 0),
    imageUrl: dbCase.image_url ?? "",
    gifUrl: dbCase.gif_url ?? undefined,
    tags: dbCase.tags ?? [],
    isPublished: dbCase.is_published ?? false,
    media: normalizeCaseMedia(dbCase.media),
  };
}

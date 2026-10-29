import { supabase } from "@/lib/supabase";
import type { Case } from "../models/case";
import { normalizeCaseMedia } from "@/features/cases/models/caseMedia";
import { getCaseAuthorDetails, getCaseCreatorUserId } from "@/features/cases/utils/caseAuthorship";

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
  created_at?: string | null;
  settings?: unknown;
  media?: unknown;
  owner_background?: string | null;
  physical_exam_findings?: string | null;
  diagnostic_findings?: string | null;
  learning_objectives?: string | null;
  details?: string | null;
  patient_name?: string | null;
  patient_breed?: string | null;
  patient_age?: string | null;
  patient_sex?: string | null;
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
  includeArchived?: boolean;
};

export function matchesDiscipline(
  item: { category?: string | null; species?: string | null },
  discipline?: string
): boolean {
  if (!discipline || discipline === "all") return true;
  const target = discipline.trim().toLowerCase();
  const cat = (item.category ?? "").trim().toLowerCase();
  const spec = (item.species ?? "").trim().toLowerCase();

  // 1. Direct equality
  if (cat === target) return true;

  const isSmallAnimal = ["canine", "feline", "dog", "cat", "puppy", "kitten", "small animal"].some((s) => spec.includes(s));
  const isEquine = ["equine", "horse", "mare", "gelding", "stallion", "foal"].some((s) => spec.includes(s));
  const isBovine = ["bovine", "cow", "cattle", "heifer", "bull", "calf", "dairy"].some((s) => spec.includes(s));
  const isLargeAnimal = isEquine || isBovine || ["ovine", "sheep", "caprine", "goat", "porcine", "pig", "swine", "large animal"].some((s) => spec.includes(s));

  // 2. Specialty & General category cross-matching
  if (target === "small animal surgery") {
    return cat === "small animal surgery" || (cat.includes("surgery") && isSmallAnimal);
  }
  if (target === "equine surgery") {
    return cat === "equine surgery" || (cat.includes("surgery") && isEquine);
  }
  if (target === "surgery") {
    return cat.includes("surgery");
  }
  if (target === "small animal internal medicine") {
    return cat === "small animal internal medicine" || (cat.includes("internal medicine") && isSmallAnimal);
  }
  if (target === "internal medicine") {
    return cat.includes("internal medicine");
  }
  if (target === "equine infectious disease") {
    return cat === "equine infectious disease" || (cat.includes("infectious disease") && isEquine);
  }
  if (target === "infectious disease") {
    return cat.includes("infectious disease");
  }
  if (target === "large animal") {
    return cat.includes("large animal") || cat.includes("food animal") || isLargeAnimal;
  }
  if (target === "food animal production medicine" || target === "food animal") {
    return cat.includes("food animal") || isBovine;
  }
  if (target === "bovine") {
    return cat.includes("bovine") || cat.includes("food animal") || isBovine;
  }
  if (target === "equine") {
    return cat.includes("equine") || isEquine;
  }
  if (target === "exotic") {
    return cat.includes("exotic") || ["exotic", "bird", "avian", "reptile"].some((s) => spec.includes(s));
  }

  // Fallback: substring matching
  return cat.includes(target) || target.includes(cat);
}

export async function fetchCases(options: FetchCasesOptions = {}): Promise<Case[]> {
  let query = supabase.from("cases").select("*").order("created_at", { ascending: true });

  if (!options.includeUnpublished) {
    query = query.eq("is_published", true);
  }

  // If no smart category filtering is needed, we can let DB filter when category is not set,
  // but if category IS set, we fetch candidates and apply specialty-aware matchesDiscipline below.

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
    query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
  }

  // If category is not set, we can push limit/offset down to the query.
  // If category IS set, we need to filter matching categories first before applying limit/offset.
  if (!options.category) {
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      const from = options.offset;
      const to = from + (options.limit || 10) - 1;
      query = query.range(from, to);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = data ?? [];

  // Exclude archived cases unless explicitly requested (stored in settings.archived)
  if (!options.includeArchived) {
    rows = rows.filter((row: any) => {
      const settings = typeof row.settings === "object" && row.settings !== null ? row.settings : {};
      const isArchived = settings.archived === true || settings.archived === "true";
      return !isArchived;
    });
  }

  // Apply smart category / discipline matching
  if (options.category) {
    rows = rows.filter((row: any) => matchesDiscipline(row, options.category));
    if (options.offset) {
      rows = rows.slice(options.offset);
    }
    if (options.limit) {
      rows = rows.slice(0, options.limit);
    }
  }

  return rows.map(mapDbCaseToCase);
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  // Try exact match first
  try {
    let { data } = await supabase.from("cases").select("*").eq("id", id).single();
    if (data) return mapDbCaseToCase(data);

    // Next try a slug column (if you have one) so URLs like /test-case-2 work
    const { data: bySlug } = await supabase.from("cases").select("*").eq("slug", id).single();
    if (bySlug) return mapDbCaseToCase(bySlug);

    // Fallback: try prefix match on id (helps when DB ids include suffixes)
    const { data: prefixMatch } = await supabase.from("cases").select("*").ilike("id", `${id}%`).limit(1);
    if (prefixMatch && prefixMatch.length > 0) return mapDbCaseToCase(prefixMatch[0]);

    return null;
  } catch (e) {
    // On any error, return null (page will show notFound). Consider logging during debugging.
    console.error("fetchCaseById error:", e);
    return null;
  }
}

export async function fetchDisciplines(): Promise<string[]> {
  try {
    const list = new Set<string>();

    // 1. Fetch from 'disciplines' table
    const { data: discData, error: discError } = await supabase.from("disciplines").select("name");
    if (!discError && discData) {
      for (const d of discData) {
        if (d.name && typeof d.name === "string" && d.name.trim()) {
          list.add(d.name.trim());
        }
      }
    }

    // 2. Fetch distinct categories from published cases so custom/new categories are always included
    const { data: casesData } = await supabase.from("cases").select("category").eq("is_published", true);
    if (casesData) {
      for (const c of casesData) {
        if (c.category && typeof c.category === "string" && c.category.trim()) {
          list.add(c.category.trim());
        }
      }
    }

    if (list.size === 0) {
      return [
        "Cardiology",
        "Dermatology",
        "Equine",
        "Equine Infectious Disease",
        "Equine Surgery",
        "Exotic",
        "Food Animal Production Medicine",
        "Infectious Disease",
        "Internal Medicine",
        "Large Animal",
        "Neurology",
        "Ophthalmology",
        "Small Animal Internal Medicine",
        "Small Animal Surgery",
        "Surgery",
      ];
    }

    return Array.from(list).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error("Failed to fetch disciplines", e);
    return [];
  }
}

export async function fetchAssignedCases(userId: string): Promise<Case[]> {
  // Query cases explicitly assigned to this student via professor_assigned_cases
  const { data: assignments, error: assignError } = await supabase
    .from("professor_assigned_cases")
    .select("case_id")
    .eq("student_id", userId);

  if (assignError || !assignments || assignments.length === 0) return [];

  const caseIds = assignments.map((a) => a.case_id);

  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("*")
    .in("id", caseIds);

  if (casesError || !cases) return [];

  return cases.map(mapDbCaseToCase);
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
    estimatedTime: typeof dbCase.estimated_time === "number" ? dbCase.estimated_time : Number(dbCase.estimated_time || 0),
    imageUrl: dbCase.image_url ?? "",
    gifUrl: dbCase.gif_url ?? undefined,
    tags: dbCase.tags ?? [],
    isPublished: dbCase.is_published ?? false,
    createdAt: dbCase.created_at ?? undefined,
    creatorUserId: getCaseCreatorUserId(dbCase.settings) ?? undefined,
    ...getCaseAuthorDetails(dbCase.settings, dbCase.details),
    media: normalizeCaseMedia(dbCase.media),
    ownerBackground: dbCase.owner_background ?? undefined,
    physicalExamFindings: dbCase.physical_exam_findings ?? undefined,
    learningObjectives: dbCase.learning_objectives ?? undefined,
    diagnosticFindings: dbCase.diagnostic_findings ?? undefined,
    details: dbCase.details ?? undefined,
    patientName: dbCase.patient_name ?? undefined,
    patientBreed: dbCase.patient_breed ?? (dbCase as any).settings?.patient_breed ?? undefined,
    patientAge: dbCase.patient_age ?? undefined,
    patientSex: dbCase.patient_sex ?? undefined,
  };
}

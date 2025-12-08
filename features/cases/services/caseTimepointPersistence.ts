import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapDbTimepoints,
  prepareTimepointsForPersistence,
  type CaseTimepoint,
  type CaseTimepointInput,
} from "@/features/cases/models/caseTimepoint";

export async function replaceCaseTimepoints(
  supabase: SupabaseClient,
  caseId: string,
  timepoints: CaseTimepointInput[]
): Promise<{ data: CaseTimepoint[]; error: Error | null }> {
  if (!caseId) {
    return { data: [], error: new Error("caseId is required") };
  }

  const normalized = prepareTimepointsForPersistence(caseId, timepoints);

  const deleteResult = await supabase
    .from("case_timepoints")
    .delete()
    .eq("case_id", caseId);

  if (deleteResult.error) {
    return { data: [], error: deleteResult.error }; // Bubble up Supabase error
  }

  if (normalized.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("case_timepoints")
    .insert(normalized)
    .select();

  if (error) {
    return { data: [], error };
  }

  return { data: mapDbTimepoints(data), error: null };
}

export async function fetchCaseTimepoints(
  supabase: SupabaseClient,
  caseId: string
): Promise<{ data: CaseTimepoint[]; error: Error | null }> {
  if (!caseId) {
    return { data: [], error: new Error("caseId is required") };
  }

  const { data, error } = await supabase
    .from("case_timepoints")
    .select("*")
    .eq("case_id", caseId)
    .order("sequence", { ascending: true });

  if (error) {
    return { data: [], error };
  }

  return { data: mapDbTimepoints(data), error: null };
}

import { supabase } from "./supabase";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("Failed to read Supabase session while building auth headers", error);
      return {};
    }

    const token = data?.session?.access_token;
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  } catch (err) {
    console.warn("Unexpected error fetching auth headers", err);
    return {};
  }
}
import { supabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  try {
    // Primary: new supabase-js v2 shape
    if (supabase?.auth && typeof supabase.auth.getSession === "function") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    }

    // Fallback: older supabase-js v1 shape
    if (supabase?.auth && typeof (supabase.auth as any).session === "function") {
      const session = (supabase.auth as any).session();
      if (session?.access_token) return session.access_token;
    }

    // Backup: try refreshing if available
    if (supabase?.auth && typeof supabase.auth.refreshSession === "function") {
      const { data: refreshData } = await supabase.auth.refreshSession();
      return refreshData?.session?.access_token ?? null;
    }
  } catch (err) {
    // Be resilient in tests/environments where the supabase client is shimmed.
    // Fall through to null below.
  }

  return null;
}

export async function buildAuthHeaders(base: Record<string, string> = {}, token?: string | null): Promise<Record<string, string>> {
  const resolvedToken = token !== undefined ? token : await getAccessToken();

  if (!resolvedToken) {
    return base;
  }

  return {
    ...base,
    Authorization: `Bearer ${resolvedToken}`,
  };
}

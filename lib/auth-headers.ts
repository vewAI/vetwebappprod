import { supabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return session.access_token;
  }

  // Backup: try refreshing if no session found 
  const { data: refreshData } = await supabase.auth.refreshSession();
  return refreshData?.session?.access_token ?? null;
}

export async function buildAuthHeaders(
  base: Record<string, string> = {},
  token?: string | null
): Promise<Record<string, string>> {
  const resolvedToken =
    token !== undefined ? token : await getAccessToken();

  if (!resolvedToken) {
    return base;
  }

  return {
    ...base,
    Authorization: `Bearer ${resolvedToken}`,
  };
}

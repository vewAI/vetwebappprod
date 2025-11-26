import { supabase } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
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

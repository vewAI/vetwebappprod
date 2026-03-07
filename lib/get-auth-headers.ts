import { supabase } from "./supabase";
import {
  clearInvalidRefreshTokenState,
  isRefreshTokenAuthError,
} from "./supabase-auth-error-utils";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isRefreshTokenAuthError(error)) {
        await clearInvalidRefreshTokenState(supabase);
        return {};
      }
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
type SupabaseLikeClient = {
  auth?: {
    signOut?: (options?: { scope?: "global" | "local" | "others" }) => Promise<unknown>;
  };
};

export function isRefreshTokenAuthError(error: unknown): boolean {
  const err = (error ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
  const code = String(err.code ?? err.name ?? "").toLowerCase();
  const message = String(err.message ?? "").toLowerCase();

  return (
    code === "refresh_token_not_found" ||
    message.includes("refresh token") ||
    message.includes("invalid refresh") ||
    message.includes("invalid grant") ||
    message.includes("invalid_grant")
  );
}

function clearBrowserSupabaseStorage(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem("supabase.auth.token");
    window.localStorage.removeItem("supabase.auth");
    window.localStorage.removeItem("sb-access-token");
    window.localStorage.removeItem("sb-refresh-token");

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Best-effort only.
  }
}

export async function clearInvalidRefreshTokenState(supabaseClient?: SupabaseLikeClient): Promise<void> {
  try {
    const signOut = supabaseClient?.auth?.signOut;
    if (typeof signOut === "function") {
      // Local scope avoids unnecessary network churn on stale refresh tokens.
      await signOut({ scope: "local" });
    }
  } catch {
    // Continue with local storage cleanup below.
  }

  clearBrowserSupabaseStorage();
}

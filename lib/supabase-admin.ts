import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that authenticates with the service role key so we can bypass
 * row-level security for trusted backend workflows. Never import this from client components.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedClient: SupabaseClient | null = null;
let warnedMissingEnv = false;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV !== "production" && !warnedMissingEnv) {
      console.warn(
        "Supabase admin client unavailable. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the server environment."
      );
      warnedMissingEnv = true;
    }
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}

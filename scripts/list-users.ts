import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing");
console.log("Key:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Missing");

async function listUsers() {
  // Dynamic import to ensure env vars are loaded first
  const { getSupabaseAdminClient } = await import("../lib/supabase-admin");
  
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("Failed to initialize Supabase Admin Client");
    process.exit(1);
  }

  console.log("Fetching users from Auth...");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("Error fetching auth users:", authError);
    process.exit(1);
  }

  console.log("Fetching profiles...");
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*");

  if (profileError) {
    console.error("Error fetching profiles:", profileError);
    process.exit(1);
  }

  console.log("\n--- Registered Users ---");
  console.table(users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at,
    role: profiles?.find(p => p.user_id === u.id)?.role || "N/A (No Profile)"
  })));
}

listUsers();

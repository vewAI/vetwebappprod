import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }
  const supabase = createClient(url, key as string);

  try {
    const { data, error } = await supabase
      .from("case_knowledge")
      .select("id, case_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Query error:", error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log("No case_knowledge rows found.");
      return;
    }

    console.log(`Found ${data.length} recent case_knowledge rows:`);
    for (const row of data) {
      const src = row.metadata && row.metadata.source ? row.metadata.source : "(none)";
      const caseId = row.case_id ?? "(null)";
      console.log(`- id=${row.id} case_id=${caseId} source=${src} created_at=${row.created_at}`);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

main();

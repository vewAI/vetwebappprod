#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { CASE_SEEDS } from "../data/cases/case-seed-data";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL env var.");
    process.exit(1);
  }
  if (!serviceRoleKey && !anonKey) {
    console.error(
      "Provide SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY to seed cases."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey ?? anonKey!);

  for (const seed of CASE_SEEDS) {
    try {
      const { error } = await supabase
        .from("cases")
        .upsert(seed, { onConflict: "id" });
      if (error) {
        console.error(`Failed to upsert ${seed.id}:`, error.message);
        process.exitCode = 1;
      } else {
        console.log(`Upserted ${seed.id}`);
      }
    } catch (error) {
      console.error(`Unexpected error while seeding ${seed.id}:`, error);
      process.exitCode = 1;
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  } else {
    console.log("Case seeding complete.");
  }
}

void main();

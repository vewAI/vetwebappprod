#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error(chalk.red("Missing NEXT_PUBLIC_SUPABASE_URL env var."));
    process.exit(1);
  }

  const apiKey = serviceKey ?? anonKey;
  if (!apiKey) {
    console.error(
      chalk.red(
        "Provide SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY to seed shared personas."
      )
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, apiKey);

  console.log(chalk.cyan("Ensuring shared personas exist..."));
  try {
    await ensureSharedPersonas(supabase);
    console.log(chalk.green("Shared personas are up to date."));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to ensure shared personas: ${message}`));
    process.exit(1);
  }
}

void main();

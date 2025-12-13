#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";

interface CaseRow {
  id: string;
  [key: string]: unknown;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error(chalk.red("Missing NEXT_PUBLIC_SUPABASE_URL env var."));
    process.exit(1);
  }

  if (!serviceKey) {
    console.error(chalk.red("Missing SUPABASE_SERVICE_ROLE_KEY. Cleanup requires service-level access."));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(chalk.cyan("Fetching non-owner personas for backup..."));
  const { data: nonOwnerRows, error: fetchError } = await supabase
    .from("case_personas")
    .select("*")
    .neq("role_key", "owner");

  if (fetchError) {
    console.error(chalk.red(`Failed to read case_personas: ${fetchError.message}`));
    process.exit(1);
  }

  const backupPath = path.resolve(
    process.cwd(),
    "tmp",
    `case-personas-backup-${Date.now()}.json`
  );

  try {
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, JSON.stringify(nonOwnerRows ?? [], null, 2), "utf8");
    console.log(chalk.green(`Backed up ${nonOwnerRows?.length ?? 0} rows to ${backupPath}`));
  } catch (writeError) {
    const message = writeError instanceof Error ? writeError.message : String(writeError);
    console.error(chalk.red(`Failed to write backup file: ${message}`));
    process.exit(1);
  }

  console.log(chalk.cyan("Removing non-owner personas from case_personas..."));
  const { error: deleteError } = await supabase
    .from("case_personas")
    .delete()
    .neq("role_key", "owner");

  if (deleteError) {
    console.error(chalk.red(`Failed to delete non-owner personas: ${deleteError.message}`));
    process.exit(1);
  }

  console.log(chalk.cyan("Ensuring shared personas are present..."));
  await ensureSharedPersonas(supabase);

  console.log(chalk.cyan("Refreshing owner personas for each case..."));
  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("*");

  if (casesError) {
    console.error(chalk.red(`Failed to read cases: ${casesError.message}`));
    process.exit(1);
  }

  for (const record of (cases ?? []) as CaseRow[]) {
    try {
      await ensureCasePersonas(supabase, record.id, record);
      console.log(chalk.green(`Refreshed personas for case ${record.id}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Failed to refresh personas for case ${record.id}: ${message}`));
      process.exitCode = 1;
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error(chalk.red("One or more cases failed to refresh. Check logs for details."));
    process.exit(process.exitCode);
  } else {
    console.log(chalk.green("Case persona cleanup complete."));
  }
}

void main();

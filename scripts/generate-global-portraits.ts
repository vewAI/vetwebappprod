#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import OpenAi from "openai";
import chalk from "chalk";
import { generateMissingGlobalPortraits } from "@/features/personas/services/personaImageService";

function parseArgs() {
  const options: { roleKey?: string; force?: boolean } = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--role=")) {
      options.roleKey = arg.split("=")[1];
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    }
  }
  return options;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl) {
    console.error(chalk.red("Missing NEXT_PUBLIC_SUPABASE_URL env var."));
    process.exit(1);
  }

  if (!serviceKey) {
    console.error(
      chalk.red("Missing SUPABASE_SERVICE_ROLE_KEY. Shared portrait generation requires service access.")
    );
    process.exit(1);
  }

  if (!openaiKey) {
    console.error(chalk.red("Missing OPENAI_API_KEY."));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const openai = new OpenAi({ apiKey: openaiKey });
  const args = parseArgs();

  console.log(chalk.cyan("Generating shared persona portraits"));
  if (args.roleKey) {
    console.log(chalk.cyan(`Filtering to role ${args.roleKey}`));
  }
  if (args.force) {
    console.log(chalk.cyan("Force regeneration enabled"));
  }

  try {
    await generateMissingGlobalPortraits(supabase, openai, args);
    console.log(chalk.green("Shared persona portrait generation complete."));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Failed to generate shared portraits: ${message}`));
    process.exit(1);
  }
}

void main();

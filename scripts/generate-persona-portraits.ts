import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAi from "openai";
import chalk from "chalk";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { getOrGeneratePersonaPortrait } from "@/features/personas/services/personaImageService";

type CaseRow = Record<string, unknown> & {
  id: string;
  title?: string | null;
  species?: string | null;
};

interface PersonaRow {
  id: string;
  role_key?: string | null;
  display_name?: string | null;
  status?: string | null;
  image_url?: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. This script requires service-level access.");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Set it before running the portrait generator.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { caseId?: string; force?: boolean } = {};
  for (const arg of args) {
    if (arg.startsWith("--case=")) {
      options.caseId = arg.split("=")[1];
    } else if (arg === "--force" || arg === "-f") {
      options.force = true;
    }
  }
  return options;
}

async function fetchCases(caseId?: string): Promise<CaseRow[]> {
  const query = supabase.from("cases").select("*");
  const response = caseId
    ? await query.eq("id", caseId)
    : await query.order("id", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  return response.data ?? [];
}

async function fetchPersonas(caseId: string): Promise<PersonaRow[]> {
  const { data, error } = await supabase
    .from("case_personas")
    .select("id, role_key, display_name, status, image_url")
    .eq("case_id", caseId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function generatePortrait(caseId: string, persona: PersonaRow, force: boolean) {
  if (!persona.role_key) {
    console.warn(
      chalk.yellow(`Skipping persona ${persona.id} for case ${caseId}: missing role_key.`)
    );
    return false;
  }

  if (!force && persona.status === "ready" && persona.image_url) {
    return false;
  }

  if (force && persona.id) {
    await supabase
      .from("case_personas")
      .update({ status: "pending", image_url: null })
      .eq("id", persona.id);
  }

  const result = await getOrGeneratePersonaPortrait({
    supabase,
    openai,
    caseId,
    stageRole: persona.role_key ?? undefined,
    displayRole: persona.display_name ?? undefined,
  });

  if (result.imageUrl) {
    console.log(
      chalk.green(
        `✓ Generated portrait for ${persona.display_name ?? persona.role_key} (${caseId})`
      )
    );
    return true;
  }

  console.warn(
    chalk.yellow(
      `No portrait generated for ${persona.display_name ?? persona.role_key} (${caseId}).`
    )
  );
  return false;
}

async function main() {
  const { caseId, force } = parseArgs();
  console.log(chalk.cyan("Starting persona portrait generation"));
  if (caseId) {
    console.log(chalk.cyan(`Filtering to case ${caseId}`));
  }
  if (force) {
    console.log(chalk.cyan("Force regeneration enabled"));
  }

  const cases = await fetchCases(caseId);
  if (!cases.length) {
    console.log(chalk.yellow("No cases found. Nothing to generate."));
    return;
  }

  let generatedCount = 0;
  for (const record of cases) {
    const caseTitle =
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim()
        : undefined;
    console.log(
      chalk.blue(
        `\nProcessing case ${record.id}${caseTitle ? ` – ${caseTitle}` : ""}`
      )
    );

    await ensureCasePersonas(supabase, record.id, record);
    const personas = await fetchPersonas(record.id);

    if (!personas.length) {
      console.log(chalk.yellow("  No personas defined for this case."));
      continue;
    }

    for (const persona of personas) {
      try {
        const didGenerate = await generatePortrait(record.id, persona, Boolean(force));
        if (didGenerate) {
          generatedCount += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          chalk.red(
            `  ✗ Failed to generate portrait for ${persona.display_name ?? persona.role_key}: ${message}`
          )
        );
      }
    }
  }

  console.log(
    chalk.cyan(`\nDone. ${generatedCount} portrait${generatedCount === 1 ? "" : "s"} generated.`)
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Unexpected error: ${message}`));
  process.exit(1);
});

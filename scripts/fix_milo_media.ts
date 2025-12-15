import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(chalk.red("Missing Supabase credentials"));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixMiloMedia() {
  const caseId = "case-2"; // Milo

  console.log(chalk.cyan(`Fetching case ${caseId}...`));
  const { data: caseData, error: fetchError } = await supabase
    .from("cases")
    .select("media")
    .eq("id", caseId)
    .single();

  if (fetchError || !caseData) {
    console.error(chalk.red("Error fetching case"), fetchError);
    return;
  }

  const media = Array.isArray(caseData.media) ? caseData.media : [];
  console.log(chalk.yellow(`Found ${media.length} media items.`));

  let updatedCount = 0;
  const updatedMedia = media.map((m: any) => {
    // Update all media items to Stage 4
    updatedCount++;
    return {
      ...m,
      stage: {
        stageId: "stage-4",
        stageKey: "Laboratory & Tests",
        roleKey: "Laboratory Technician"
      }
    };
  });

  if (updatedCount === 0) {
    console.log(chalk.yellow("No media items to update."));
    return;
  }

  console.log(chalk.green(`Updating ${updatedCount} media items to Stage 4...`));

  // Save back to database
  const { error: updateError } = await supabase
    .from("cases")
    .update({ media: updatedMedia })
    .eq("id", caseId);

  if (updateError) {
    console.error(chalk.red("Error updating case media"), updateError);
  } else {
    console.log(chalk.green("Successfully updated Milo's case media!"));
  }
}

fixMiloMedia();

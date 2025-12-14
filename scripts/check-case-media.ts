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

async function checkCaseMedia() {
  // Find case-2 ID
  const { data: cases } = await supabase
    .from("cases")
    .select("id, slug, title")
    .ilike("slug", "%parvo%") // Assuming case-2 is the parvo case
    .single();

  if (!cases) {
    console.log("Case not found via slug, trying ID 'case-2'");
  }
  
  const caseId = cases?.id || "case-2";
  console.log(chalk.cyan(`Checking media for case: ${caseId}`));

  const { data: caseData, error } = await supabase
    .from("cases")
    .select("id, media")
    .eq("id", caseId)
    .single();

  if (error) {
    console.error(chalk.red("Error fetching case:", error.message));
    return;
  }

  const media = caseData.media || [];
  console.log(chalk.yellow(`Found ${media.length} media items:`));
  media.forEach((m: any) => {
    console.log(`- [${m.type}] ${m.caption || "No caption"} | Trigger: ${chalk.bold(m.trigger || "null")} | Stage: ${JSON.stringify(m.stage)}`);
  });
}

checkCaseMedia();

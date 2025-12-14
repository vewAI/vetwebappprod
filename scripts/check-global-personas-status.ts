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

async function checkStatus() {
  const { data, error } = await supabase
    .from("global_personas")
    .select("role_key, status, image_url")
    .order("role_key");

  if (error) {
    console.error(chalk.red("Error fetching personas:", error.message));
    return;
  }

  console.log(chalk.cyan(`Found ${data.length} global personas.`));
  
  const counts = data.reduce((acc, p) => {
    acc[p.status || "unknown"] = (acc[p.status || "unknown"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(chalk.yellow("Status counts:"), counts);

  const owners = data.filter(p => p.role_key.startsWith("owner-pool"));
  console.log(chalk.cyan(`Found ${owners.length} owner-pool personas.`));
  if (owners.length > 0) {
    console.log(chalk.yellow(`First 3 owners:`));
    owners.slice(0, 3).forEach(p => {
      console.log(`- ${p.role_key}: ${p.status} | URL: ${p.image_url ? p.image_url.substring(0, 50) + "..." : "null"}`);
    });
  }

  const pending = data.filter(p => p.status !== "ready");
  if (pending.length > 0) {
    console.log(chalk.yellow(`First 5 pending/failed:`));
    pending.slice(0, 5).forEach(p => {
      console.log(`- ${p.role_key}: ${p.status}`);
    });
  }
}

checkStatus();

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName =
  process.env.PERSONA_IMAGE_BUCKET ??
  process.env.NEXT_PUBLIC_PERSONA_IMAGE_BUCKET ??
  "persona-images";

if (!supabaseUrl) {
  console.error(chalk.red("Missing NEXT_PUBLIC_SUPABASE_URL. Unable to reset persona portraits."));
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error(
    chalk.red(
      "Missing SUPABASE_SERVICE_ROLE_KEY. A service key is required to remove stored persona portraits."
    )
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type PersonaRow = {
  id: string;
  case_id: string;
  role_key: string;
  image_url: string | null;
};

function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const marker = `/${bucketName}/`;
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const raw = url.slice(index + marker.length);
    return decodeURIComponent(raw);
  } catch (error) {
    console.warn("Unable to parse storage path for", url, error);
    return null;
  }
}

async function removeStorageObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;

  const uniquePaths = Array.from(new Set(paths));
  console.log(
    chalk.cyan(
      `Removing ${uniquePaths.length} object${uniquePaths.length === 1 ? "" : "s"} from bucket ${bucketName}`
    )
  );

  const { error } = await supabase.storage.from(bucketName).remove(uniquePaths);
  if (error) {
    throw new Error(`Failed to remove storage objects: ${error.message}`);
  }
}

async function deletePersonaRows(): Promise<number> {
  const { data, error } = await supabase
    .from("case_personas")
    .select("id, case_id, role_key, image_url");

  if (error) {
    throw new Error(`Failed to load persona rows: ${error.message}`);
  }

  const rows = (data ?? []) as PersonaRow[];
  if (!rows.length) {
    console.log(chalk.yellow("No persona rows found. Nothing to reset."));
    return 0;
  }

  const storagePaths: string[] = [];
  rows.forEach((row) => {
    const path = extractStoragePath(row.image_url);
    if (path) {
      storagePaths.push(path);
    }
  });

  await removeStorageObjects(storagePaths);

  const { error: deleteError } = await supabase
    .from("case_personas")
    .delete()
    .gt("created_at", "1970-01-01T00:00:00Z");

  if (deleteError) {
    throw new Error(`Failed to delete persona rows: ${deleteError.message}`);
  }

  return rows.length;
}

async function main() {
  console.log(chalk.cyan("Resetting persona portraits and metadata"));
  try {
    const removedRows = await deletePersonaRows();
    console.log(
      chalk.green(
        `Done. Cleared ${removedRows} persona record${removedRows === 1 ? "" : "s"} and associated storage objects.`
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Reset failed: ${message}`));
    process.exit(1);
  }
}

main();

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key);

    const targetId = "severe-canine-parvovirus-infection-in-a-young-puppy-c7977ddb";
    console.log(`Checking case_knowledge for case_id: "${targetId}"`);

    const { data, count, error } = await supabase
        .from("case_knowledge")
        .select("id, content, metadata, created_at", { count: "exact" })
        .eq("case_id", targetId);

    if (error) {
        console.error("Error querying case_knowledge:", error);
        return;
    }

    console.log(`Found ${data?.length || 0} chunks (Total count: ${count})`);
    if (data && data.length > 0) {
        data.slice(0, 2).forEach((chunk, i) => {
            console.log(`\nChunk ${i + 1}:`);
            console.log(`Content: ${chunk.content.substring(0, 100)}...`);
            console.log(`Metadata: ${JSON.stringify(chunk.metadata)}`);
        });
    }

    // Also check if the case exists by ID or Slug
    const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("id, slug, title")
        .or(`id.eq.${targetId},slug.eq.${targetId}`)
        .maybeSingle();

    if (caseError) {
        console.error("Error checking cases table:", caseError);
    } else if (caseRow) {
        console.log(`\nCase found in 'cases' table!`);
        console.log(`Title: "${caseRow.title}"`);
        console.log(`ID:    "${caseRow.id}"`);
        console.log(`Slug:  "${caseRow.slug}"`);

        if (caseRow.id !== targetId) {
            console.log(`\n⚠️ ID MISMATCH DETECTED!`);
            console.log(`The Target ID in UI is "${targetId}", but the Database ID is "${caseRow.id}".`);
            console.log(`Chunks are likely associated with the Database ID, not the Slug.`);
        }
    } else {
        console.log(`\nCase NOT FOUND in 'cases' table for ID or Slug: "${targetId}"`);
    }
}

main();

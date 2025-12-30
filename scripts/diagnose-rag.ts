import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key);

    // Check OpenAI Key
    console.log(`\n--- Environment Check ---`);
    console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "SET (starts with " + process.env.OPENAI_API_KEY.substring(0, 10) + "...)" : "MISSING"}`);

    // Check case_knowledge table
    console.log(`\n--- Table Verification ---`);
    const { data: tableCheck, error: tableError } = await supabase
        .from("case_knowledge")
        .select("id")
        .limit(1);

    if (tableError) {
        console.error("❌ case_knowledge table check FAILED:", tableError);
        if (tableError.code === "42P01") {
            console.error("The table 'case_knowledge' does not exist.");
        }
    } else {
        console.log("✅ case_knowledge table exists.");
    }

    const targetId = "severe-canine-parvovirus-infection-in-a-young-puppy-c7977ddb";
    console.log(`\nChecking case_knowledge for case_id: "${targetId}"`);

    const { data, count, error } = await supabase
        .from("case_knowledge")
        .select("id, content, metadata, created_at", { count: "exact" })
        .eq("case_id", targetId);

    if (error) {
        console.error("Error querying case_knowledge:", error);
    } else {
        console.log(`Found ${data?.length || 0} chunks (Total count: ${count})`);
        if (data && data.length > 0) {
            data.slice(0, 2).forEach((chunk, i) => {
                console.log(`\nChunk ${i + 1}:`);
                console.log(`Content: ${chunk.content.substring(0, 100)}...`);
                console.log(`Metadata: ${JSON.stringify(chunk.metadata)}`);
            });
        }
    }

    // Also check if the case exists by ID or Slug
    console.log(`\n--- Case Verification ---`);
    const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("id, slug, title")
        .or(`id.eq.${targetId},slug.eq.${targetId}`)
        .maybeSingle();

    if (caseError) {
        console.error("Error checking cases table:", caseError);
    } else if (caseRow) {
        console.log(`Case found!`);
        console.log(`Title: "${caseRow.title}"`);
        console.log(`ID:    "${caseRow.id}"`);
        console.log(`Slug:  "${caseRow.slug}"`);
    } else {
        console.log(`Case NOT FOUND for ID or Slug: "${targetId}"`);

        console.log(`\nListing first 10 cases in DB:`);
        const { data: allCases } = await supabase.from("cases").select("id, slug, title").limit(10);
        allCases?.forEach(c => {
            console.log(`- [${c.id}] (slug: ${c.slug}) ${c.title}`);
        });
    }
}

main();

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, key);

    console.log("\n=== RAG Status Check ===\n");

    // Total chunks
    const { count } = await supabase
        .from("case_knowledge")
        .select("*", { count: "exact", head: true });
    
    console.log(`Total knowledge chunks: ${count}`);

    // List all case_ids with chunks
    const { data: allChunks } = await supabase
        .from("case_knowledge")
        .select("case_id, metadata");

    if (allChunks && allChunks.length > 0) {
        const caseIds = new Set(allChunks.map(c => c.case_id));
        console.log(`\nCases with RAG data (${caseIds.size}):`);
        caseIds.forEach(id => {
            const caseChunks = allChunks.filter(c => c.case_id === id);
            console.log(`  - ${id}: ${caseChunks.length} chunks`);
        });
    } else {
        console.log("\n⚠️ NO RAG data found! The case_knowledge table is empty.");
    }

    // List all cases
    const { data: cases } = await supabase
        .from("cases")
        .select("id, title")
        .limit(10);

    console.log(`\nAvailable cases in DB:`);
    cases?.forEach(c => {
        const hasRag = allChunks?.some(k => k.case_id === c.id);
        console.log(`  ${hasRag ? "✅" : "❌"} ${c.id}`);
        console.log(`     "${c.title}"`);
    });
}

main();

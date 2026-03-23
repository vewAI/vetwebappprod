/**
 * Sync all cases to RAG (case_knowledge table)
 * Standalone version that doesn't require app imports
 * Run with: npx ts-node scripts/sync-all-rag.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

type CaseData = {
    id: string;
    title?: string;
    description?: string;
    patient_name?: string;
    patient_age?: string;
    patient_sex?: string;
    species?: string;
    breed?: string;
    presenting_complaint?: string;
    history?: string;
    physical_findings?: string;
    lab_results?: string;
    imaging_results?: string;
    owner_background?: string;
    differential_diagnoses?: string;
    treatment_plan?: string;
    [key: string]: any;
};

/**
 * Generate natural language knowledge chunks from case database fields
 */
function generateCaseKnowledgeChunks(caseData: CaseData): Array<{
    content: string;
    metadata: Record<string, any>;
}> {
    const chunks: Array<{ content: string; metadata: Record<string, any> }> = [];

    // 1. Patient Overview
    const patientDetails: string[] = [];
    if (caseData.patient_name) patientDetails.push(`Patient Name: ${caseData.patient_name}`);
    if (caseData.patient_age) patientDetails.push(`Age: ${caseData.patient_age}`);
    if (caseData.patient_sex) patientDetails.push(`Sex: ${caseData.patient_sex}`);
    if (caseData.species) patientDetails.push(`Species: ${caseData.species}`);
    if (caseData.breed) patientDetails.push(`Breed: ${caseData.breed}`);

    if (patientDetails.length > 0) {
        chunks.push({
            content: `[CASE_DATA - Patient Overview]\n${patientDetails.join(", ")}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "patient_overview",
                case_id: caseData.id,
            },
        });
    }

    // 2. Case Title & Description
    if (caseData.title || caseData.description) {
        const titleDesc: string[] = [];
        if (caseData.title) titleDesc.push(`Case: ${caseData.title}`);
        if (caseData.description) titleDesc.push(`Description: ${caseData.description}`);

        chunks.push({
            content: `[CASE_DATA - Case Information]\n${titleDesc.join("\n")}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "case_overview",
                case_id: caseData.id,
            },
        });
    }

    // 3. Presenting Complaint
    if (caseData.presenting_complaint) {
        chunks.push({
            content: `[CASE_DATA - Presenting Complaint]\n${caseData.presenting_complaint}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "presenting_complaint",
                case_id: caseData.id,
            },
        });
    }

    // 4. Medical History
    if (caseData.history) {
        chunks.push({
            content: `[CASE_DATA - Medical History]\n${caseData.history}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "history",
                case_id: caseData.id,
            },
        });
    }

    // 5. Physical Examination Findings
    if (caseData.physical_findings) {
        chunks.push({
            content: `[CASE_DATA - Physical Examination Findings]\n${caseData.physical_findings}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "physical_findings",
                case_id: caseData.id,
            },
        });
    }

    // 6. Laboratory Results
    if (caseData.lab_results) {
        chunks.push({
            content: `[CASE_DATA - Laboratory Results]\n${caseData.lab_results}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "lab_results",
                case_id: caseData.id,
            },
        });
    }

    // 7. Imaging Results
    if (caseData.imaging_results) {
        chunks.push({
            content: `[CASE_DATA - Imaging/Diagnostic Results]\n${caseData.imaging_results}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "imaging_results",
                case_id: caseData.id,
            },
        });
    }

    // 8. Owner/Client Background
    if (caseData.owner_background) {
        chunks.push({
            content: `[CASE_DATA - Owner/Client Information]\n${caseData.owner_background}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "owner_background",
                case_id: caseData.id,
            },
        });
    }

    // 9. Differential Diagnoses
    if (caseData.differential_diagnoses) {
        chunks.push({
            content: `[CASE_DATA - Differential Diagnoses]\n${caseData.differential_diagnoses}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "differential_diagnoses",
                case_id: caseData.id,
            },
        });
    }

    // 10. Treatment Plan
    if (caseData.treatment_plan) {
        chunks.push({
            content: `[CASE_DATA - Treatment Plan]\n${caseData.treatment_plan}`,
            metadata: {
                source: "CASE_DATA",
                data_type: "treatment_plan",
                case_id: caseData.id,
            },
        });
    }

    return chunks;
}

async function ingestCaseDataToRAG(
    supabase: SupabaseClient,
    openai: OpenAI,
    caseId: string,
    caseData: CaseData
): Promise<{ success: boolean; chunks?: number; error?: string }> {
    console.log(`[Ingestion] Starting for case ${caseId}`);

    try {
        // 1. Clear existing case data chunks
        const { error: clearError } = await supabase
            .from("case_knowledge")
            .delete()
            .eq("case_id", caseId)
            .eq("metadata->>source", "CASE_DATA");

        if (clearError) {
            return { success: false, error: `Failed to clear: ${clearError.message}` };
        }

        // 2. Generate chunks from case data
        const chunks = generateCaseKnowledgeChunks(caseData);
        console.log(`[Ingestion] Generated ${chunks.length} chunks`);

        if (chunks.length === 0) {
            return { success: true, chunks: 0 };
        }

        // 3. Generate embeddings and insert
        let insertedCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Generate embedding
            const embeddingResp = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk.content,
            });
            const embedding = embeddingResp.data[0].embedding;

            // Insert into DB
            const { error: insertError } = await supabase.from("case_knowledge").insert({
                case_id: caseId,
                content: chunk.content,
                embedding: embedding,
                metadata: {
                    ...chunk.metadata,
                    chunk_index: i,
                    total_chunks: chunks.length,
                    ingested_at: new Date().toISOString(),
                },
            });

            if (insertError) {
                console.error(`[Ingestion] Insert error for chunk ${i}:`, insertError);
            } else {
                insertedCount++;
            }
        }

        return { success: true, chunks: insertedCount };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const openaiKey = process.env.OPENAI_API_KEY!;

    if (!url || !key) {
        console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        process.exit(1);
    }
    if (!openaiKey) {
        console.error("Missing OPENAI_API_KEY");
        process.exit(1);
    }

    const supabase = createClient(url, key);
    const openai = new OpenAI({ apiKey: openaiKey });

    console.log("\n=== Syncing All Cases to RAG ===\n");

    // Fetch all cases
    const { data: cases, error } = await supabase
        .from("cases")
        .select("*");

    if (error || !cases) {
        console.error("Failed to fetch cases:", error);
        process.exit(1);
    }

    console.log(`Found ${cases.length} cases to sync.\n`);

    let success = 0;
    let failed = 0;

    for (const caseData of cases) {
        console.log(`\n--- Syncing: ${caseData.title} ---`);

        const result = await ingestCaseDataToRAG(supabase, openai, caseData.id, caseData);

        if (result.success) {
            console.log(`✅ Success! Inserted ${result.chunks} chunks.`);
            success++;
        } else {
            console.error(`❌ Failed: ${result.error}`);
            failed++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`✅ Successful: ${success}`);
    console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);

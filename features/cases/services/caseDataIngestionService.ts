import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "missing-key",
});

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
export function generateCaseKnowledgeChunks(caseData: CaseData): Array<{
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

/**
 * Clear existing case data chunks from RAG before re-ingestion
 */
export async function clearExistingCaseData(
    supabase: SupabaseClient,
    caseId: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
        console.log(`[CaseDataIngestion] Clearing existing CASE_DATA chunks for case ${caseId}...`);

        const { error, count } = await supabase
            .from("case_knowledge")
            .delete({ count: "exact" })
            .eq("case_id", caseId)
            .eq("metadata->>source", "CASE_DATA");

        if (error) {
            console.error(`[CaseDataIngestion] Error clearing chunks:`, error);
            return { success: false, error: error.message };
        }

        console.log(`[CaseDataIngestion] Deleted ${count ?? 0} existing CASE_DATA chunks`);
        return { success: true, deletedCount: count ?? 0 };
    } catch (err) {
        console.error(`[CaseDataIngestion] Exception during clear:`, err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Main function: Ingest case database fields into RAG
 */
export async function ingestCaseDataToRAG(
    supabase: SupabaseClient,
    caseId: string,
    caseData: CaseData
): Promise<{ success: boolean; chunks?: number; error?: string; code?: string }> {
    console.log(`[CaseDataIngestion] Starting ingestion for case ${caseId}`);

    // Check OpenAI Key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "missing-key") {
        console.error("[CaseDataIngestion] OPENAI_API_KEY is missing or invalid.");
        return { success: false, error: "AI service configuration missing (OpenAI Key).", code: "CONFIG_ERROR" };
    }

    try {
        // 1. Clear existing case data chunks
        const clearResult = await clearExistingCaseData(supabase, caseId);
        if (!clearResult.success) {
            return { success: false, error: `Failed to clear old data: ${clearResult.error}`, code: "DATABASE_ERROR" };
        }

        // 2. Generate chunks from case data
        const chunks = generateCaseKnowledgeChunks(caseData);
        console.log(`[CaseDataIngestion] Generated ${chunks.length} chunks from case data`);

        if (chunks.length === 0) {
            console.warn(`[CaseDataIngestion] No content to ingest for case ${caseId}`);
            return { success: true, chunks: 0 };
        }

        // 3. Generate embeddings for each chunk
        const embeddings: any[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                const response = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: chunk.content,
                });
                embeddings.push({
                    content: chunk.content,
                    embedding: response.data[0].embedding,
                    metadata: {
                        ...chunk.metadata,
                        chunk_index: i,
                        total_chunks: chunks.length,
                        ingested_at: new Date().toISOString(),
                    },
                });
            } catch (embErr) {
                console.error(`[CaseDataIngestion] Embedding generation failed for chunk ${i}:`, embErr);
                return {
                    success: false,
                    error: `AI processing failed: ${embErr instanceof Error ? embErr.message : String(embErr)}`,
                    code: "OPENAI_ERROR",
                };
            }
        }

        console.log(`[CaseDataIngestion] Generated ${embeddings.length} embeddings`);

        // 4. Insert into case_knowledge
        let insertedCount = 0;
        for (const item of embeddings) {
            const { error } = await supabase.from("case_knowledge").insert({
                case_id: caseId,
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata,
            });

            if (error) {
                console.error(`[CaseDataIngestion] Error inserting chunk ${insertedCount}:`, error);
                return {
                    success: false,
                    error: `Database error: ${error.message}`,
                    code: "DATABASE_ERROR",
                };
            }
            insertedCount++;
        }

        console.log(`[CaseDataIngestion] Successfully inserted ${insertedCount} CASE_DATA chunks for case ${caseId}`);
        return { success: true, chunks: insertedCount };
    } catch (err) {
        console.error(`[CaseDataIngestion] Unexpected error:`, err);
        return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            code: "UNKNOWN_ERROR",
        };
    }
}

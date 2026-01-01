import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { RecursiveCharacterTextSplitter } from "@/lib/text-splitter";

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "missing-key",
});

export async function ingestCaseMaterial(
    supabase: SupabaseClient,
    caseIdentifier: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
) {
    console.log(`[Ingestion] Starting for ${fileName} (${mimeType}) - identifier="${caseIdentifier}"`);

    // 0. Resolve canonical ID (handles slugs vs UUIDs)
    let caseId = caseIdentifier;
    try {
        const { data: caseInfo, error: caseErr } = await supabase
            .from("cases")
            .select("id, title")
            .or(`id.eq.${caseIdentifier},slug.eq.${caseIdentifier}`)
            .maybeSingle();

        if (caseErr) {
            console.error("[Ingestion] Error resolving case ID:", caseErr);
        } else if (caseInfo) {
            caseId = caseInfo.id;
            console.log(`[Ingestion] Resolved identifier "${caseIdentifier}" to canonical ID "${caseId}" (${caseInfo.title})`);
        } else {
            console.warn(`[Ingestion] Warning: Could not find case in DB for "${caseIdentifier}". Using as-is.`);
        }
    } catch (err) {
        console.error("[Ingestion] Exception during case ID resolution:", err);
        // Continue with original identifier
    }

    // 1. Extract Text
    let text = "";
    try {
        if (mimeType === "application/pdf") {
            const data = await pdf(fileBuffer);
            text = data.text || "";
        } else if (
            mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            mimeType === "application/msword"
        ) {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            text = result.value;
        } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
            text = fileBuffer.toString("utf-8");
        } else {
            return { success: false, error: `Unsupported file type: ${mimeType}`, code: "UNSUPPORTED_TYPE" };
        }
    } catch (err) {
        console.error(`[Ingestion] Text extraction failed for ${fileName}:`, err);
        return {
            success: false,
            error: `Failed to extract text: ${err instanceof Error ? err.message : String(err)}`,
            code: "EXTRACTION_ERROR"
        };
    }

    // Clean text
    text = text.replace(/\0/g, ""); // Remove null bytes
    console.log(`[Ingestion] Extracted ${text.length} characters from ${fileName}`);

    if (text.trim().length === 0) {
        console.warn(`[Ingestion] No text extracted from ${fileName}. Aborting.`);
        return { success: false, error: "The file appears to be empty or unreadable.", code: "EMPTY_TEXT" };
    }

    // 2. Chunk Text
    let chunks: string[] = [];
    try {
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });
        chunks = splitter.splitText(text);
        console.log(`[Ingestion] Split into ${chunks.length} chunks for caseId="${caseId}"`);
    } catch (err) {
        console.error(`[Ingestion] Chunking failed:`, err);
        return { success: false, error: "Failed to process text into chunks.", code: "CHUNKING_ERROR" };
    }

    // check OpenAI Key explicitly
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "missing-key") {
        console.error("[Ingestion] OPENAI_API_KEY is missing or invalid.");
        return { success: false, error: "AI service configuration missing (OpenAI Key).", code: "CONFIG_ERROR" };
    }

    // 3. Generate Embeddings & Upsert
    const embeddings: any[] = [];
    try {
        // We do them in batch or one by one. One by one is easier to debug for now.
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: chunk,
            });
            embeddings.push({
                content: chunk,
                embedding: response.data[0].embedding,
                metadata: {
                    source: fileName,
                    chunk_index: i,
                    total_chunks: chunks.length,
                },
            });
        }
    } catch (err) {
        console.error(`[Ingestion] OpenAI Embedding generation failed:`, err);
        return {
            success: false,
            error: `AI processing failed: ${err instanceof Error ? err.message : String(err)}`,
            code: "OPENAI_ERROR"
        };
    }

    console.log(`[Ingestion] Generated ${embeddings.length} embeddings. Starting DB insertion...`);

    // 4. Save to DB
    let insertedCount = 0;
    try {
        for (const item of embeddings) {
            const { error } = await supabase.from("case_knowledge").insert({
                case_id: caseId,
                content: item.content,
                embedding: item.embedding,
                metadata: item.metadata,
            });

            if (error) {
                console.error(`[Ingestion] Error inserting chunk ${insertedCount} for caseId="${caseId}":`, error);
                throw error;
            }
            insertedCount++;
        }
    } catch (err) {
        console.error(`[Ingestion] Database insertion failed:`, err);
        return {
            success: false,
            error: `Database error: ${err instanceof Error ? err.message : String(err)}`,
            code: "DATABASE_ERROR"
        };
    }

    console.log(`[Ingestion] Successfully inserted ${insertedCount} chunks for caseId="${caseId}" into case_knowledge`);
    return { success: true, chunks: insertedCount };
}

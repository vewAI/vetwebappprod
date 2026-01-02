import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import llm from "@/lib/llm";
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

    // 3. Generate Embeddings & Upsert
    const embeddings: any[] = [];
    try {
        // Resolve provider and prefer provider-specific model env vars
        const provider = await llm.resolveProviderForFeature("embeddings");
        let preferredModel = "";
        let fallbackModels: string[] = [];

        if (provider === "aistudio") {
            preferredModel = process.env.AISTUDIO_EMBEDDING_MODEL || "aistudio-embed-1";
            const fb = process.env.AISTUDIO_EMBEDDING_FALLBACKS || "";
            fallbackModels = fb.split(",").map(s => s.trim()).filter(Boolean);
        } else if (provider === "gemini") {
            preferredModel = process.env.GEMINI_EMBEDDING_MODEL || "textembedding-gecko-001";
            const fb = process.env.GEMINI_EMBEDDING_FALLBACKS || "";
            fallbackModels = fb.split(",").map(s => s.trim()).filter(Boolean);
        } else {
            preferredModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
            const fb = process.env.OPENAI_EMBEDDING_FALLBACKS || "";
            fallbackModels = fb.split(",").map(s => s.trim()).filter(Boolean);
        }

        const modelsToTry = [preferredModel, ...fallbackModels];

        // Helper to determine if an error looks like a model-access problem
        const isModelAccessError = (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            return /does not have access to model/i.test(msg) || /Model "[\w-]+" not found/i.test(msg) || (err && typeof (err as any).status === 'number' && (err as any).status === 403);
        };

        // Try each chunk, using the first model that works. If a model returns
        // a model-access error, try the next model in the list. Any other
        // error aborts the whole operation.
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // Ask the adapter for embeddings. Adapter will consult tmp config or env
                // to decide provider (OpenAI or Gemini) so this enables the pilot.
                const out = await llm.embeddings([chunk], { model: modelsToTry[0] as any });
                const vec = out[0];
                embeddings.push({
                    content: chunk,
                    embedding: vec.embedding,
                    metadata: {
                        source: fileName,
                        chunk_index: i,
                        total_chunks: chunks.length,
                        embedding_model: vec.model,
                    },
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const isModelAccess = /does not have access to model/i.test(msg) || /not configured|Gemini API key not configured/i.test(msg) || (err && typeof (err as any).status === 'number' && (err as any).status === 403);
                if (isModelAccess) {
                    console.error(`[Ingestion] Embedding model access error for model ${modelsToTry[0]}:`, err);
                    return {
                        success: false,
                        error: `AI processing failed: ${msg}`,
                        code: "EMBEDDING_MODEL_ACCESS",
                        model: modelsToTry[0],
                    };
                }
                throw err;
            }
        }
    } catch (err) {
        console.error(`[Ingestion] OpenAI Embedding generation failed:`, err);
        return {
            success: false,
            error: `AI processing failed: ${err instanceof Error ? err.message : String(err)}`,
            code: "OPENAI_ERROR",
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

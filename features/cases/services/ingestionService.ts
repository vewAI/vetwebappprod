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
    const { data: caseInfo } = await supabase
        .from("cases")
        .select("id, title")
        .or(`id.eq.${caseIdentifier},slug.eq.${caseIdentifier}`)
        .maybeSingle();

    const caseId = caseInfo?.id || caseIdentifier;
    if (!caseInfo) {
        console.warn(`[Ingestion] Warning: Could not find case in DB for "${caseIdentifier}". Using as-is.`);
    } else {
        console.log(`[Ingestion] Resolved identifier "${caseIdentifier}" to canonical ID "${caseId}" (${caseInfo.title})`);
    }

    // 1. Extract Text
    let text = "";
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
        throw new Error(`Unsupported file type for ingestion: ${mimeType}`);
    }

    // Clean text
    text = text.replace(/\0/g, ""); // Remove null bytes
    console.log(`[Ingestion] Extracted ${text.length} characters from ${fileName}`);

    if (text.trim().length === 0) {
        console.warn(`[Ingestion] No text extracted from ${fileName}. Aborting.`);
        return { success: false, chunks: 0, reason: "no_text_extracted" };
    }

    // 2. Chunk Text
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });
    const chunks = splitter.splitText(text);

    console.log(`[Ingestion] Split into ${chunks.length} chunks for caseId="${caseId}"`);

    // 3. Generate Embeddings & Upsert
    const embeddings = await Promise.all(
        chunks.map(async (chunk, index) => {
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
            });
            return {
                content: chunk,
                embedding: response.data[0].embedding,
                metadata: {
                    source: fileName,
                    chunk_index: index,
                    total_chunks: chunks.length,
                },
            };
        })
    );

    console.log(`[Ingestion] Generated ${embeddings.length} embeddings. Starting DB insertion...`);

    // 4. Save to DB
    let insertedCount = 0;
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

    console.log(`[Ingestion] Successfully inserted ${insertedCount} chunks for caseId="${caseId}" into case_knowledge`);

    return { success: true, chunks: insertedCount };
}

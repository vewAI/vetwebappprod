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
    caseId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
) {
    console.log(`Starting ingestion for ${fileName} (${mimeType})`);

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

    // 2. Chunk Text
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });
    const chunks = splitter.splitText(text);

    console.log(`Split into ${chunks.length} chunks`);

    // 3. Generate Embeddings & Upsert
    const embeddings = await Promise.all(
        chunks.map(async (chunk, index) => {
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002", // or text-embedding-3-small
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

    // 4. Save to DB
    for (const item of embeddings) {
        const { error } = await supabase.from("case_knowledge").insert({
            case_id: caseId,
            content: item.content,
            embedding: item.embedding,
            metadata: item.metadata,
        });

        if (error) {
            console.error("Error inserting chunk", error);
            throw error;
        }
    }

    return { success: true, chunks: chunks.length };
}

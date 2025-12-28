export class RecursiveCharacterTextSplitter {
    chunkSize: number;
    chunkOverlap: number;

    constructor({ chunkSize = 1000, chunkOverlap = 200 } = {}) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
    }

    splitText(text: string): string[] {
        if (!text) return [];

        // Simple implementation of recursive splitting
        // 1. Split by double newline (paragraphs)
        const paragraphs = text.split(/\n\n+/);
        const chunks: string[] = [];
        let currentChunk = "";

        for (const paragraph of paragraphs) {
            if ((currentChunk + "\n\n" + paragraph).length <= this.chunkSize) {
                currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
            } else {
                // If the paragraph itself is too large, split by newline
                if (paragraph.length > this.chunkSize) {
                    const lines = paragraph.split(/\n/);
                    for (const line of lines) {
                        if ((currentChunk + "\n" + line).length <= this.chunkSize) {
                            currentChunk += (currentChunk ? "\n" : "") + line;
                        } else {
                            if (currentChunk) chunks.push(currentChunk);
                            currentChunk = line; // Potentially still too long, but simple fallback
                        }
                    }
                } else {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = paragraph;
                }
            }
        }
        if (currentChunk) chunks.push(currentChunk);

        // Check for overlap creation (simplified)
        // Real implementation would handle overlap more gracefully by keeping a buffer
        // For now, this is a "Good Enough" implementation for V1
        return chunks;
    }
}

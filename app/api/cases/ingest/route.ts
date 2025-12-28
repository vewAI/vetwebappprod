import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { ingestCaseMaterial } from "@/features/cases/services/ingestionService";

export async function POST(req: Request) {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;
    const { adminSupabase, role } = auth;

    // Only Professors and Admins can ingest knowledge
    if (role !== "professor" && role !== "admin") {
        return NextResponse.json({ error: "Forbidden. only professors and admins can upload case materials." }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const caseId = formData.get("case_id") as string;

        if (!file || !caseId) {
            return NextResponse.json({ error: "Missing file or case_id" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Call ingestion service
        // We pass adminSupabase which allows skipping RLS or standard write access 
        // depending on how requireUser configures it. 
        // Since we manually checked role above, this is safe.
        const result = await ingestCaseMaterial(
            adminSupabase ?? auth.supabase,
            caseId,
            buffer,
            file.name,
            file.type
        );

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("Ingestion error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
    }
}

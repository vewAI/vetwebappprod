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
        const result = await ingestCaseMaterial(
            adminSupabase ?? auth.supabase,
            caseId,
            buffer,
            file.name,
            file.type
        );

        // Check if the service returned an error
        if (!result.success && "code" in result) {
            console.error(`[Ingestion API] Service returned error: ${result.code} - ${result.error}`);

            // Map error codes to appropriate HTTP status codes
            const statusCode = result.code === "CONFIG_ERROR" ? 503 :
                result.code === "UNSUPPORTED_TYPE" ? 415 :
                    result.code === "EMPTY_TEXT" ? 422 : 500;

            return NextResponse.json({
                error: result.error,
                code: result.code,
                success: false
            }, { status: statusCode });
        }

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("Ingestion error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({
            error: msg || "Unknown error",
            code: "UNKNOWN_ERROR",
            success: false
        }, { status: 500 });
    }
}

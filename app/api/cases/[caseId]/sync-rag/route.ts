import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { ingestCaseDataToRAG } from "@/features/cases/services/caseDataIngestionService";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ caseId: string }> }
) {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;
    const { adminSupabase, role } = auth;

    // Only Professors and Admins can sync case data
    if (role !== "professor" && role !== "admin") {
        return NextResponse.json(
            { error: "Forbidden. Only professors and admins can sync case data to RAG." },
            { status: 403 }
        );
    }

    const { caseId } = await params;

    try {
        // Fetch the case data
        const { data: caseRow, error: caseError } = await (adminSupabase ?? auth.supabase)
            .from("cases")
            .select("*")
            .eq("id", caseId)
            .maybeSingle();

        if (caseError || !caseRow) {
            console.error(`[SyncCaseData] Case not found: ${caseId}`, caseError);
            return NextResponse.json(
                { error: "Case not found", code: "CASE_NOT_FOUND" },
                { status: 404 }
            );
        }

        // Ingest case data to RAG
        const result = await ingestCaseDataToRAG(
            adminSupabase ?? auth.supabase,
            caseId,
            caseRow
        );

        if (!result.success && "code" in result) {
            const statusCode =
                result.code === "CONFIG_ERROR" ? 503 :
                    result.code === "DATABASE_ERROR" ? 500 : 500;

            return NextResponse.json(
                {
                    error: result.error,
                    code: result.code,
                    success: false,
                },
                { status: statusCode }
            );
        }

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("[SyncCaseData] Error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
            {
                error: msg || "Unknown error",
                code: "UNKNOWN_ERROR",
                success: false,
            },
            { status: 500 }
        );
    }
}

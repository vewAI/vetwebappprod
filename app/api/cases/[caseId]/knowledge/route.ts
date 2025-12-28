import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ caseId: string }> }
) {
    const params = await props.params;
    const auth = await requireUser(request);
    if ("error" in auth) {
        return auth.error;
    }
    const { supabase, user, role } = auth;
    const caseId = params.caseId;

    if (!caseId) {
        return NextResponse.json({ error: "Case ID required" }, { status: 400 });
    }

    // Verify permission (professor/admin)
    if (role !== "professor" && role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { data, error } = await supabase
            .from("case_knowledge")
            .select("id, content, metadata, created_at, embedding_model, file_path")
            .eq("case_id", caseId)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        return NextResponse.json({ data });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Failed to fetch knowledge" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ caseId: string }> }
) {
    const params = await props.params;
    const auth = await requireUser(request);
    if ("error" in auth) {
        return auth.error;
    }
    const { supabase, user, role } = auth;
    const caseId = params.caseId;

    if (role !== "professor" && role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { ids, source } = body;

        if (source) {
            // Delete all chunks from a specific source
            const { error } = await supabase
                .from("case_knowledge")
                .delete()
                .eq("case_id", caseId)
                .eq("metadata->>source", source);

            if (error) throw error;
            return NextResponse.json({ success: true, source });
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No IDs or source provided" }, { status: 400 });
        }

        const { error } = await supabase
            .from("case_knowledge")
            .delete()
            .eq("case_id", caseId)
            .in("id", ids);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, count: ids.length });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Failed to delete knowledge" },
            { status: 500 }
        );
    }
}

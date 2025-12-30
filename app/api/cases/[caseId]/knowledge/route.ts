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
    const { adminSupabase, supabase, user, role } = auth;
    const db = adminSupabase ?? supabase;
    const caseId = params.caseId;

    if (!caseId) {
        return NextResponse.json({ error: "Case ID required" }, { status: 400 });
    }

    // Verify permission (professor/admin)
    const normalizedRole = role?.toLowerCase();
    console.log(`[Knowledge API] GET caseId=${caseId} user=${user.id} role=${role}`);

    if (normalizedRole !== "professor" && normalizedRole !== "admin") {
        console.warn(`[Knowledge API] Forbidden: user ${user.id} has role ${role}`);
        return NextResponse.json({ error: `Unauthorized. Role: ${role}` }, { status: 403 });
    }

    try {
        console.log(`[Knowledge API] Querying knowledge for caseIdentifier="${caseId}"`);

        // 1. Resolve canonical ID (handles slugs vs UUIDs)
        const { data: caseInfo, error: caseErr } = await db
            .from("cases")
            .select("id, slug, title")
            .or(`id.eq.${caseId},slug.eq.${caseId}`)
            .maybeSingle();

        if (caseErr) {
            console.error(`[Knowledge API] Error resolving case:`, caseErr);
        }

        const canonicalId = caseInfo?.id || caseId;
        const slug = caseInfo?.slug;
        const title = caseInfo?.title || "Unknown Case";

        // Check both canonical ID and the identifier provided (in case they differ)
        const idsToQuery = Array.from(new Set([canonicalId, caseId]));
        if (slug) idsToQuery.push(slug);

        console.log(`[Knowledge API] Case resolved: "${title}". Searching chunks for IDs: ${idsToQuery.join(', ')}`);

        // 2. Query chunks
        const { data, count, error } = await db
            .from("case_knowledge")
            .select("id, content, metadata, created_at", { count: "exact" })
            .in("case_id", idsToQuery)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`[Knowledge API] DB Error fetching chunks:`, error);
            throw error;
        }

        console.log(`[Knowledge API] Found ${data?.length || 0} chunks for caseIdentifier="${caseId}" (Resolved ID: ${canonicalId})`);

        return NextResponse.json({
            success: true,
            data: data || [],
            total: count || 0,
            resolvedId: canonicalId,
            caseTitle: title
        });
    } catch (err: any) {
        console.error(`[Knowledge API] Unexpected Error:`, err);
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
    const { adminSupabase, supabase, user, role } = auth;
    const db = adminSupabase ?? supabase;
    const caseId = params.caseId;

    if (role !== "professor" && role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { ids, source } = body;

        if (source) {
            // Delete all chunks from a specific source
            const { error } = await db
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

        const { error } = await db
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

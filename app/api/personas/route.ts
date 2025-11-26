import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json(
      { error: "caseId query param is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("case_personas")
      .select(
        "id, case_id, role_key, display_name, status, image_url, prompt, metadata, generated_by, last_generated_at, updated_at"
      )
      .eq("case_id", caseId)
      .order("role_key", { ascending: true });

    if (error) {
      console.error(
        "Failed to load personas",
        JSON.stringify({ caseId, message: error.message, details: error.details, hint: error.hint })
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ personas: data ?? [] });
  } catch (error) {
    console.error("Unhandled personas API error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

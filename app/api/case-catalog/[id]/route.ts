import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const CASE_CATALOG_FIELDS = [
  "id",
  "title",
  "description",
  "species",
  "condition",
  "category",
  "difficulty",
  "estimated_time",
  "image_url",
];

export async function GET(
  req: Request,
  { params }: { params: { id?: string } }
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  let caseId = params?.id;
  if (!caseId) {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    caseId = segments[segments.length - 1];
  }
  if (!caseId) {
    return NextResponse.json({ error: "Missing case id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cases")
    .select(CASE_CATALOG_FIELDS.join(","))
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    console.error("case-catalog detail failed", error);
    return NextResponse.json(
      { error: "Failed to load case" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

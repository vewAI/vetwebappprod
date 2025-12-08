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

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("cases")
    .select(CASE_CATALOG_FIELDS.join(","))
    .order("title", { ascending: true });

  if (error) {
    console.error("case-catalog list failed", error);
    return NextResponse.json(
      { error: "Failed to load cases" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}

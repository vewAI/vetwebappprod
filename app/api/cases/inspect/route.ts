import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/_lib/auth";

const promptFields = [
  "description",
  "details",
  "physical_exam_findings",
  "diagnostic_findings",
  "owner_background",
  "history_feedback",
  "owner_follow_up",
  "owner_follow_up_feedback",
  "owner_diagnosis",
  "get_owner_prompt",
  "get_history_feedback_prompt",
  "get_physical_exam_prompt",
  "get_diagnostic_prompt",
  "get_owner_follow_up_prompt",
  "get_owner_follow_up_feedback_prompt",
  "get_owner_diagnosis_prompt",
  "get_overall_feedback_prompt",
];

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { supabase } = auth;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    // Use a non-single select: the DB may contain duplicate ids. Handle 0/1/multiple rows.
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: `No case found with id ${id}` },
        { status: 404 }
      );
    }

    // If multiple rows match, return a per-row report
    const rows: Array<{
      case: Record<string, unknown>;
      missing: Record<string, string>;
      missingCount: number;
    }> = [];
    for (const row of data) {
      const missing: Record<string, string> = {};
      const r = row as Record<string, unknown>;
      for (const field of promptFields) {
        const val = r[field];
        if (
          val === null ||
          val === undefined ||
          (typeof val === "string" && val.trim() === "")
        ) {
          missing[field] = "missing or empty";
        }
      }
      rows.push({
        case: r,
        missing,
        missingCount: Object.keys(missing).length,
      });
    }

    if (rows.length === 1) {
      return NextResponse.json({
        case: rows[0].case,
        missing: rows[0].missing,
        missingCount: rows[0].missingCount,
      });
    }

    return NextResponse.json({
      warning: `Multiple (${rows.length}) rows found for id ${id}`,
      rows,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

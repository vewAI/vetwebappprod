import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { generateCaseFieldContentAsync } from "@/features/prompts/services/casePromptAutomation";
import { isCaseFieldAutomatable } from "@/features/prompts/services/casePromptAutomation";

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const auth = await requireUser(request as Request);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { caseId } = await context.params;
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const fields: string[] = Array.isArray(body?.fields) ? body.fields : ["details", "physical_exam_findings", "diagnostic_findings"];

  const { data: caseRow, error: caseErr } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (caseErr) return NextResponse.json({ error: caseErr.message ?? "Failed to load case" }, { status: 500 });
  if (!caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  for (const f of fields) {
    if (!isCaseFieldAutomatable(f)) continue;
    try {
      const generated = await generateCaseFieldContentAsync({ caseId, caseField: f, id: `auto-${caseId}-${f}` } as any, caseRow, { usePapers: true });
      if (generated) {
        const existing = typeof caseRow[f] === "string" ? (caseRow[f] as string) : "";
        // append generated content if not already present
        const next = existing && existing.trim().length > 0 ? `${existing}\n\n${generated}` : generated;
        updates[f] = next;
      }
    } catch (e) {
      console.warn("Failed to generate field", f, e);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No updates generated" });
  }

  const { error: updateErr } = await supabase.from("cases").update(updates).eq("id", caseId);
  if (updateErr) return NextResponse.json({ error: updateErr.message ?? "Failed to update case" }, { status: 500 });

  return NextResponse.json({ updated: Object.keys(updates) });
}

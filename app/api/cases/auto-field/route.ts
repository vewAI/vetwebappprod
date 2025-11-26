import { NextResponse } from "next/server";

import {
  generateCaseFieldContentForCaseField,
  isCaseFieldAutomatable,
  type CasePromptAutomationOptions,
} from "@/features/prompts/services/casePromptAutomation";
import {
  buildDiagnosticPromptCopy,
  DEFAULT_DIAGNOSTIC_PROMPT_COPY,
  DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID,
  DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID,
} from "@/features/prompts/config/diagnosticPrompts";
import { resolvePromptValue } from "@/features/prompts/services/promptService";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(request: Request) {
  let caseId: string | undefined;
  let field: string | undefined;

  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  try {
    const body = await request.json();
    if (typeof body?.caseId === "string") {
      caseId = body.caseId;
    }
    if (typeof body?.field === "string") {
      field = body.field;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  if (!field) {
    return NextResponse.json({ error: "field is required" }, { status: 400 });
  }

  if (!isCaseFieldAutomatable(field)) {
    return NextResponse.json(
      { error: "Automation is not available for this field" },
      { status: 422 }
    );
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (caseError) {
    return NextResponse.json(
      { error: caseError.message ?? "Failed to load case" },
      { status: 500 }
    );
  }

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  let options: CasePromptAutomationOptions | undefined;
  if (field === "diagnostic_findings") {
    const [header, footerPrefix, footerSuffix] = await Promise.all([
      resolvePromptValue(
        supabase,
        DIAGNOSTIC_FINDINGS_HEADER_PROMPT_ID,
        DEFAULT_DIAGNOSTIC_PROMPT_COPY.header
      ),
      resolvePromptValue(
        supabase,
        DIAGNOSTIC_FINDINGS_FOOTER_PREFIX_PROMPT_ID,
        DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerPrefix
      ),
      resolvePromptValue(
        supabase,
        DIAGNOSTIC_FINDINGS_FOOTER_SUFFIX_PROMPT_ID,
        DEFAULT_DIAGNOSTIC_PROMPT_COPY.footerSuffix
      ),
    ]);

    options = {
      diagnosticCopy: buildDiagnosticPromptCopy({
        header,
        footerPrefix,
        footerSuffix,
      }),
    };
  }

  const generated = generateCaseFieldContentForCaseField(
    caseId,
    field,
    caseRow,
    options
  );
  if (!generated) {
    return NextResponse.json(
      { error: "Automation could not generate content for this field." },
      { status: 422 }
    );
  }

  return NextResponse.json({ content: generated });
}

import { NextResponse } from "next/server";
import { findPromptDefinition } from "@/features/prompts/registry";
import {
  generateCaseFieldContent,
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
import { requireAdmin } from "@/app/api/_lib/auth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  let id: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.id === "string") {
      id = body.id;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: "Prompt id is required" }, { status: 400 });
  }

  const definition = findPromptDefinition(id);
  if (!definition) {
    return NextResponse.json({ error: "Prompt definition not found" }, { status: 404 });
  }

  if (!definition.caseId || !definition.caseField) {
    return NextResponse.json(
      { error: "Automation is only available for case-linked prompts" },
      { status: 422 }
    );
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", definition.caseId)
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
  if (definition.caseField === "diagnostic_findings") {
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

  const generated = generateCaseFieldContent(definition, caseRow, options);
  if (!generated) {
    return NextResponse.json(
      { error: "No automation is available for this field" },
      { status: 422 }
    );
  }

  const { error: updateError } = await supabase
    .from("cases")
    .update({ [definition.caseField]: generated })
    .eq("id", definition.caseId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update case" },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabase
    .from("app_prompts")
    .delete()
    .eq("id", id);

  if (deleteError && deleteError.code !== "PGRST116") {
    return NextResponse.json(
      { error: deleteError.message ?? "Failed to clear overrides" },
      { status: 500 }
    );
  }

  return NextResponse.json({ content: generated });
}

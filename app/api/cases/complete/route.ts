import { NextResponse } from "next/server";
import OpenAi from "openai";
import {
  applyCaseDefaults,
  enrichCaseWithModel,
  mergeAugmentedFields,
  scrubConflictingSpeciesStrings,
  type CasePayload,
} from "@/features/cases/services/caseCompletion";
import { orderedCaseFieldKeys } from "@/features/cases/fieldMeta";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { requireAdmin } from "@/app/api/_lib/auth";

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

function sanitiseUpdatePayload(
  merged: CasePayload,
  id: string
): Record<string, unknown> {
  const update: Record<string, unknown> = { id };

  for (const key of orderedCaseFieldKeys) {
    const value = merged[key];

    if (key === "id") {
      update[key] = id;
      continue;
    }

    if (key === "estimated_time") {
      if (value === undefined || value === null || value === "") {
        update[key] = null;
        continue;
      }
      const n = Number(value);
      update[key] = Number.isFinite(n) ? n : null;
      continue;
    }

    if (key === "details") {
      if (value === undefined || value === null || value === "") {
        update[key] = null;
        continue;
      }

      if (typeof value === "string") {
        try {
          update[key] = JSON.parse(value);
        } catch {
          update[key] = value;
        }
      } else {
        update[key] = value;
      }
      continue;
    }

    update[key] = value ?? null;
  }

  return update;
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { supabase } = auth;
    const payload = (await req.json()) as {
      id?: unknown;
      draft?: CasePayload | null;
    };
    const id = typeof payload?.id === "string" ? payload.id.trim() : "";

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    const baseCase: CasePayload = { ...existing };

    const draft = payload?.draft;
    if (draft && typeof draft === "object" && !Array.isArray(draft)) {
      for (const [key, value] of Object.entries(draft)) {
        if (key === "id") continue;
        if (value === undefined) continue;
        baseCase[key] = value as unknown;
      }
    }

    const baseSpecies =
      typeof baseCase["species"] === "string" ? baseCase["species"] : null;
    scrubConflictingSpeciesStrings(baseCase, baseSpecies);

    const modelInput: CasePayload = JSON.parse(JSON.stringify(baseCase));
    scrubConflictingSpeciesStrings(modelInput, baseSpecies);
    applyCaseDefaults(modelInput);

    let augmented: CasePayload = {};
    try {
      augmented = await enrichCaseWithModel(modelInput, openai);
    } catch (err) {
      console.warn("LLM enrichment failed for case completion:", err);
    }

    const merged = mergeAugmentedFields(baseCase, augmented, {
      appendStrings: true,
      species: baseSpecies,
    });

    const updatePayload = sanitiseUpdatePayload(merged, id);

    const { data: updated, error: updateError } = await supabase
      .from("cases")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (updated?.id) {
      await ensureCasePersonas(supabase, updated.id, updatePayload);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Unknown error" },
      { status: 500 }
    );
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { promptRegistry, findPromptDefinition } from "@/features/prompts/registry";
import type { PromptOverrideRow, PromptRecord } from "@/features/prompts/types";

function mapOverrides(rows: PromptOverrideRow[] | null | undefined) {
  const map = new Map<string, PromptOverrideRow>();
  (rows ?? []).forEach((row) => {
    if (row?.id) {
      map.set(row.id, row);
    }
  });
  return map;
}

export async function loadPromptRecords(
  supabase: SupabaseClient,
  opts: { caseId?: string | null } = {}
): Promise<PromptRecord[]> {
  const { data, error } = await supabase
    .from("app_prompts")
    .select("id, value, updated_at, updated_by");

  if (error) {
    throw error;
  }

  const overrides = mapOverrides(data as PromptOverrideRow[]);

  const entries = promptRegistry.filter((entry) => {
    if (!opts.caseId) return true;
    return entry.caseId === opts.caseId;
  });

  const caseRows = new Map<string, Record<string, unknown>>();

  const caseBoundEntries = entries.filter(
    (entry) => entry.caseId && entry.caseField
  );

  if (caseBoundEntries.length > 0) {
    const caseIds = Array.from(
      new Set(
        caseBoundEntries
          .map((entry) => entry.caseId)
          .filter((id): id is string => typeof id === "string")
      )
    );

    const fields = Array.from(
      new Set(
        caseBoundEntries
          .map((entry) => entry.caseField)
          .filter((field): field is string => typeof field === "string")
      )
    );

    if (caseIds.length > 0 && fields.length > 0) {
      const selectColumns = ["id", ...fields].join(",");
      try {
        const { data: caseData, error: caseError } = await supabase
          .from("cases")
          .select(selectColumns)
          .in("id", caseIds);

        if (!caseError && Array.isArray(caseData)) {
          for (const row of caseData) {
            if (row && typeof row === "object" && "id" in row) {
              const idValue = (row as { id?: unknown }).id;
              if (typeof idValue === "string") {
                caseRows.set(idValue, row as Record<string, unknown>);
              }
            }
          }
        } else if (caseError) {
          console.warn(
            "Failed to fetch case defaults for prompts:",
            caseError
          );
        }
      } catch (caseErr) {
        console.warn("Error loading case defaults for prompts:", caseErr);
      }
    }
  }

  const coerceFieldValue = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (value == null) {
      return undefined;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      console.warn("Unable to stringify prompt case field value", err);
      return undefined;
    }
  };

  return entries.map((entry) => {
    const override = overrides.get(entry.id);
    let defaultValue = entry.defaultValue;

    if (entry.caseId && entry.caseField) {
      const caseRow = caseRows.get(entry.caseId);
      const fieldValue = coerceFieldValue(caseRow?.[entry.caseField]);
      if (fieldValue !== undefined) {
        defaultValue = fieldValue;
      }
    }

    const value = override?.value ?? defaultValue;

    return {
      ...entry,
      defaultValue,
      value,
      hasOverride: Boolean(override),
      updatedAt: override?.updated_at ?? null,
      updatedBy: override?.updated_by ?? null,
    } satisfies PromptRecord;
  });
}

export async function upsertPromptOverride(
  supabase: SupabaseClient,
  id: string,
  value: string,
  actor?: string | null
): Promise<void> {
  const definition = findPromptDefinition(id);
  if (!definition) {
    throw new Error(`Unknown prompt id: ${id}`);
  }

  const trimmed = value.trim();

  if (trimmed === definition.defaultValue.trim()) {
    await supabase.from("app_prompts").delete().eq("id", id);
    return;
  }

  const payload = {
    id,
    value: trimmed,
    updated_by: actor ?? null,
  };

  await supabase.from("app_prompts").upsert(payload, { onConflict: "id" });
}

export async function resolvePromptValue(
  supabase: SupabaseClient,
  id: string,
  fallback: string
): Promise<string> {
  const definition = findPromptDefinition(id);
  const base = definition?.defaultValue ?? fallback;

  const { data, error } = await supabase
    .from("app_prompts")
    .select("value")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to resolve prompt override", id, error);
    return base;
  }

  if (!data || typeof data.value !== "string") {
    return base;
  }

  return data.value;
}

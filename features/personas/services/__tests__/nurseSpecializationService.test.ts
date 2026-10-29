import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshSpecializedNurseCases } from "../nurseSpecializationService";

describe("refreshSpecializedNurseCases", () => {
  it("copies saved ranges and bundles to system-assigned case nurses", async () => {
    const nurseRow = {
      id: "nurse-1",
      species_key: "equine",
      display_name: "Sarah Mitchell",
      skills: [],
      lab_reference_ranges: { PCV: "saved PCV range" },
      vital_reference_ranges: { HeartRate: "saved heart rate range" },
      common_pathologies: [],
      metadata: { bundled_tests: { haematology: ["PCV"] } },
    };
    const persona = {
      id: "case-nurse-1",
      metadata: { customNote: "keep", nurseSpecialization: { speciesKey: "equine", labReferenceRanges: {} } },
    };
    const selectCase = {
      contains: vi.fn(async () => ({ data: [persona], error: null })),
    };
    const caseFilters = {
      eq: vi.fn().mockReturnThis(),
      contains: selectCase.contains,
    };
    const updateFilters = { eq: vi.fn().mockReturnThis() };
    updateFilters.eq.mockImplementationOnce(() => updateFilters).mockImplementationOnce(async () => ({ error: null }));
    const update = vi.fn((_changes: { metadata: Record<string, unknown> }) => updateFilters);
    const caseTable = {
      select: vi.fn(() => caseFilters),
      update,
    };
    const nurseTable = {
      select: vi.fn(() => ({
        eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: nurseRow, error: null }) }) }),
      })),
    };
    const supabase = {
      from: vi.fn((table: string) => table === "nurse_specializations" ? nurseTable : caseTable),
    } as unknown as SupabaseClient;

    expect(await refreshSpecializedNurseCases(supabase, "equine")).toBe(1);
    expect(caseFilters.eq).toHaveBeenCalledWith("generated_by", "system");
    expect(selectCase.contains).toHaveBeenCalledWith("metadata", { nurseSpecialization: { speciesKey: "equine" } });
    const updated = update.mock.calls[0][0].metadata as {
      customNote: string;
      nurseSpecialization: { labReferenceRanges: Record<string, string>; bundledTests: Record<string, string[]> };
    };
    expect(updated.customNote).toBe("keep");
    expect(updated.nurseSpecialization.labReferenceRanges).toEqual({ PCV: "saved PCV range" });
    expect(updated.nurseSpecialization.bundledTests).toEqual({ haematology: ["PCV"] });
  });
});

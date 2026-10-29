import { describe, it, expect } from "vitest";
import { caseFieldMeta, orderedCaseFieldKeys, createEmptyCaseFormState } from "@/features/cases/fieldMeta";
import { formatSpeciesKnowledgePrompt } from "@/features/personas/services/speciesKnowledgeFormatter";

describe("Case Field Meta - Signalment & Breed", () => {
  it("includes patient_breed in caseFieldMeta with appropriate clinical label and help", () => {
    expect(caseFieldMeta.patient_breed).toBeDefined();
    expect(caseFieldMeta.patient_breed.label).toBe("Patient Breed");
    expect(caseFieldMeta.patient_breed.placeholder).toContain("Thoroughbred");
    expect(caseFieldMeta.patient_breed.help).toContain("signalment");
  });

  it("places patient_breed directly alongside patient_name in orderedCaseFieldKeys", () => {
    const nameIndex = orderedCaseFieldKeys.indexOf("patient_name");
    const breedIndex = orderedCaseFieldKeys.indexOf("patient_breed");
    expect(nameIndex).toBeGreaterThan(-1);
    expect(breedIndex).toBe(nameIndex + 1);
  });

  it("initializes patient_breed as an empty string in empty form state", () => {
    const empty = createEmptyCaseFormState();
    expect(empty.patient_breed).toBe("");
  });
});

describe("Species Knowledge & Diagnostic Simulation Rules", () => {
  it("injects clinical simulation instructions stating authored findings are ground-truth and unspecified are normal", () => {
    const prompt = formatSpeciesKnowledgePrompt({
      speciesKey: "equine",
      labReferenceRanges: {
        "Albumin": "28 - 38 g/L",
        "WBC": "5.5 - 12.5 x10^9/L",
      },
    });

    expect(prompt).toContain("LAB REFERENCE RANGES (equine):");
    expect(prompt).toContain("Albumin: 28 - 38 g/L");
    expect(prompt).toContain("DIAGNOSTIC & CLINICAL SIMULATION INSTRUCTIONS FOR NURSE");
    expect(prompt).toContain("Auto-Simulation of Unspecified Normal Values");
    expect(prompt).toContain("CLINICALLY NORMAL");
    expect(prompt).toContain("WITHIN the species LAB REFERENCE RANGES");
  });
});

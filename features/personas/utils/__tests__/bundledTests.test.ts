import { describe, it, expect } from "vitest";
import {
  STANDARD_BUNDLE_DEFINITIONS,
  getDefaultBundledTests,
  normalizeBundleKey,
  formatBundledTestsForPrompt,
  getPanelAnalytesFromBundles,
} from "../bundledTests";

describe("bundledTests", () => {
  it("provides 12 standard veterinary bundles with correct default tests", () => {
    const defaults = getDefaultBundledTests();
    expect(STANDARD_BUNDLE_DEFINITIONS.length).toBe(12);
    expect(Object.keys(defaults).length).toBe(12);

    expect(defaults.haematology).toContain("Red Blood Cell count (RBC)");
    expect(defaults.haematology).toContain("Platelets (PLT)");
    expect(defaults.biochemistry).toContain("Glucose");
    expect(defaults.biochemistry).toContain("Aspartate aminostransferase (AST)");
    expect(defaults.coagulation).toContain("Partial Thromboplastin Time (aPTT)");
    expect(defaults.urinalysis).toContain("Specific gravity");
    expect(defaults.peritoneal_fluid).toContain("Total nucleated cell count (TNCC)");
    expect(defaults.tracheal_wash).toContain("Epithelial cell percent");
    expect(defaults.bronchoalveolar_lavage).toContain("Macrophage percent");
    expect(defaults.cerebrospinal_fluid).toContain("Albumin quotient");
  });

  it("normalizes bundle keys regardless of casing, spacing, and synonyms", () => {
    expect(normalizeBundleKey("CBC")).toBe("haematology");
    expect(normalizeBundleKey("Haematology Panel")).toBe("haematology");
    expect(normalizeBundleKey("Biochemistry")).toBe("biochemistry");
    expect(normalizeBundleKey("Chem")).toBe("biochemistry");
    expect(normalizeBundleKey("ABG")).toBe("arterial_blood_gas");
    expect(normalizeBundleKey("Venous Blood Gas")).toBe("venous_blood_gas");
    expect(normalizeBundleKey("Coagulation")).toBe("coagulation");
    expect(normalizeBundleKey("Urinalysis")).toBe("urinalysis");
    expect(normalizeBundleKey("TW Cytology")).toBe("tracheal_wash");
    expect(normalizeBundleKey("BAL")).toBe("bronchoalveolar_lavage");
    expect(normalizeBundleKey("CSF")).toBe("cerebrospinal_fluid");
  });

  it("formats bundled tests cleanly for injection into nurse AI prompt", () => {
    const custom = {
      haematology: ["RBC", "WBC", "PLT"],
      biochemistry: ["Glucose", "Creatinine", "Urea"],
    };
    const prompt = formatBundledTestsForPrompt(custom, "equine");
    expect(prompt).toContain("STANDARD BUNDLED TEST PROFILES (EQUINE):");
    expect(prompt).toContain("• If asked for “Haematology (CBC)”: Report ONLY: RBC, WBC, PLT.");
    expect(prompt).toContain("• If asked for “Biochemistry”: Report ONLY: Glucose, Creatinine, Urea.");
    expect(prompt).toContain("GATED/SPECIFIC TESTS RULE:");
  });

  it("extracts normalized analyte sets including acronyms for results matching", () => {
    const analyteSets = getPanelAnalytesFromBundles({
      haematology: ["Red Blood Cell count (RBC)", "Platelets (PLT)"],
      biochemistry: ["Aspartate aminostransferase (AST)", "Glucose"],
    });

    expect(analyteSets.haematology.has("rbc")).toBe(true);
    expect(analyteSets.haematology.has("red blood cell count")).toBe(true);
    expect(analyteSets.haematology.has("plt")).toBe(true);
    expect(analyteSets.haematology.has("platelets")).toBe(true);
    expect(analyteSets.cbc.has("rbc")).toBe(true);

    expect(analyteSets.biochemistry.has("ast")).toBe(true);
    expect(analyteSets.biochemistry.has("glucose")).toBe(true);
    expect(analyteSets.chem.has("glucose")).toBe(true);
  });
});

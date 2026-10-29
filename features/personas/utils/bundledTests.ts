/**
 * Utilities and default definitions for Nurse Specialization Bundled Tests / Diagnostic Panels.
 * Synchronizes what tests are included in standard profiles (Haematology, Biochemistry,
 * Coagulation, Fluid Cytologies, etc.) across the Nurse Admin UI, Nurse AI Prompt,
 * and the Live Results Matching Engine.
 */

export type BundledTestsMap = Record<string, string[]>;

export function bundleLabel(bundleId: string): string {
  return STANDARD_BUNDLE_DEFINITIONS.find((definition) => definition.id === bundleId)?.label
    ?? bundleId.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function bundlesForTest(bundles: BundledTestsMap, testName: string): string[] {
  return Object.entries(bundles)
    .filter(([, tests]) => tests.includes(testName))
    .map(([bundleId]) => bundleId);
}

export function setTestBundleMembership(
  bundles: BundledTestsMap,
  testName: string,
  bundleId: string,
  included: boolean,
): BundledTestsMap {
  const tests = bundles[bundleId] ?? [];
  return {
    ...bundles,
    [bundleId]: included
      ? tests.includes(testName) ? tests : [...tests, testName]
      : tests.filter((test) => test !== testName),
  };
}

export function renameTestInBundles(bundles: BundledTestsMap, oldName: string, newName: string): BundledTestsMap {
  if (oldName === newName) return bundles;
  return Object.fromEntries(
    Object.entries(bundles).map(([bundleId, tests]) => [
      bundleId,
      [...new Set(tests.map((test) => test === oldName ? newName : test))],
    ]),
  );
}

export interface BundleDefinition {
  id: string;
  label: string;
  description: string;
  defaultTests: string[];
}

export const STANDARD_BUNDLE_DEFINITIONS: BundleDefinition[] = [
  {
    id: "haematology",
    label: "Haematology (CBC)",
    description: "Standard complete blood count and differential",
    defaultTests: [
      "Red Blood Cell count (RBC)",
      "Haematocrit (hct)",
      "Haemoglobin",
      "MCV",
      "MCH",
      "MCHC",
      "RDW",
      "WBC",
      "Neutrophils",
      "Lymphocytes",
      "Monocytes",
      "Eosinophils",
      "Platelets (PLT)",
    ],
  },
  {
    id: "biochemistry",
    label: "Biochemistry",
    description: "Standard serum/plasma biochemistry profile",
    defaultTests: [
      "Glucose",
      "Creatine",
      "Urea",
      "Calcium",
      "Sodium",
      "Potassium",
      "Chloride",
      "Total Protein",
      "Albumin",
      "Globulin",
      "Aspartate aminostransferase (AST)",
      "Alkaline phosphatase (ALP)",
      "gamma-glutamyltransferase (GGT)",
      "LDH",
      "total Bilirubin",
      "Creatine Kinase (CK)",
    ],
  },
  {
    id: "arterial_blood_gas",
    label: "Arterial Blood Gas (ABG)",
    description: "5-parameter arterial respiratory and acid-base profile",
    defaultTests: [
      "pH",
      "paO2",
      "paCO2",
      "Base Excess (BE)",
      "Bicarbonate",
    ],
  },
  {
    id: "venous_blood_gas",
    label: "Venous Blood Gas (VBG)",
    description: "5-parameter venous metabolic and acid-base profile",
    defaultTests: [
      "pH",
      "paO2",
      "paCO2",
      "Base Excess (BE)",
      "Bicarbonate",
    ],
  },
  {
    id: "coagulation",
    label: "Coagulation Profile",
    description: "Hemostasis and clotting factors profile",
    defaultTests: [
      "Partial Thromboplastin Time (aPTT)",
      "Prothrombin Time (PT)",
      "Activated Clotting time (ACT)",
      "Factor VII",
      "Factor VIII",
      "Factor IX",
      "Factor X",
    ],
  },
  {
    id: "urinalysis",
    label: "Urinalysis",
    description: "Physical, chemical, and sediment urine examination",
    defaultTests: [
      "Urine pH",
      "Specific gravity",
      "Red blood cells (RBC)",
      "White blood cells (WBC)",
      "Protein",
      "Glucose",
      "Creatinine clearance",
      "Fractional excretion of sodium",
      "Fractional excretion of potassium",
      "Fractional excretion of chloride",
      "Fractional excretion of phosphorus",
      "Fractional excretion of calcium",
      "Fractional excretion of magnesium",
      "Gamma-glutamyl transferase (GGT)/creatinine ratio",
      "Corticoid/creatinine ratio",
    ],
  },
  {
    id: "peritoneal_fluid",
    label: "Peritoneal Fluid",
    description: "Abdominocentesis fluid analysis and cytology",
    defaultTests: [
      "Protein",
      "Total nucleated cell count (TNCC)",
      "Neutrophil %",
      "Mononuclear cells %",
      "Lymphocytes %",
      "Eosinophils %",
      "Basophils %",
      "Total RBC count",
      "Fibrinogen",
    ],
  },
  {
    id: "tracheal_wash",
    label: "Tracheal Wash (TW)",
    description: "Tracheal aspirate wash cytology",
    defaultTests: [
      "Total nucleated cell count",
      "Neutrophil percent",
      "Lymphocyte percent",
      "Macrophage percent",
      "Mast cell percent",
      "Eosinophils percent",
      "Epithelial cell percent",
    ],
  },
  {
    id: "bronchoalveolar_lavage",
    label: "Bronchoalveolar Lavage (BAL)",
    description: "Lower airway BAL cytology",
    defaultTests: [
      "Total nucleated cell count",
      "Neutrophil percent",
      "Lymphocyte percent",
      "Macrophage percent",
      "Mast cell percent",
      "Eosinophil percent",
      "Epithelial cells percent",
    ],
  },
  {
    id: "cerebrospinal_fluid",
    label: "Cerebrospinal Fluid (CSF)",
    description: "CSF analysis, chemistry and cell counts",
    defaultTests: [
      "Total protein",
      "Albumin quotient",
      "Total nucleated cell count",
      "Neutrophil count",
      "Monocyte count",
      "Lymphocyte count",
      "Total red blood cell count (RBC)",
      "Glucose",
      "Lactate",
      "Creatine kinase",
      "Aspartate aminotransferase (AST)",
      "Lactate dehydrogenase",
      "Sodium",
      "Potassium",
      "Chloride",
      "Calcium",
      "Phosphorus",
      "Urea",
    ],
  },
  {
    id: "pleural_fluid",
    label: "Pleural Fluid",
    description: "Thoracocentesis pleural fluid analysis",
    defaultTests: [
      "Volume",
      "Total red blood cell (RBC) count",
      "Total nucleated cell count",
      "Neutrophil count",
      "Neutrophil percent",
      "Lymphocyte count",
      "Lymphocytes percent",
      "Large mononuclear cell count",
      "Large mononuclear cell percent",
      "Eosinophil count",
      "Eosinophil percent",
      "Total protein",
    ],
  },
  {
    id: "synovial_fluid",
    label: "Synovial Fluid",
    description: "Arthrocentesis joint fluid analysis and cytology",
    defaultTests: [
      "Total protein",
      "Total nucleated cell count",
      "Neutrophil percent",
      "Mononuclear cells percent",
    ],
  },
];

/**
 * Returns default standard bundled tests map keyed by bundle ID.
 */
export function getDefaultBundledTests(): BundledTestsMap {
  const result: BundledTestsMap = {};
  for (const def of STANDARD_BUNDLE_DEFINITIONS) {
    result[def.id] = [...def.defaultTests];
  }
  return result;
}

/**
 * Normalizes a bundle key for comparisons and API lookups.
 */
export function normalizeBundleKey(rawKey: string): string {
  const s = rawKey.toLowerCase().replace(/[\s\-_]+/g, "");
  if (s.includes("haemat") || s.includes("hemat") || s.includes("cbc")) return "haematology";
  if (s.includes("chem") || s.includes("biochem")) return "biochemistry";
  if (s.includes("abg") || (s.includes("arterial") && s.includes("gas"))) return "arterial_blood_gas";
  if (s.includes("vbg") || (s.includes("venous") && s.includes("gas"))) return "venous_blood_gas";
  if (s.includes("coag") || s.includes("clotting")) return "coagulation";
  if (s.includes("urine") || s.includes("urinalys")) return "urinalysis";
  if (s.includes("periton") || s.includes("abdomino")) return "peritoneal_fluid";
  if (s.includes("tracheal") || s.includes("tw")) return "tracheal_wash";
  if (s.includes("broncho") || s.includes("bal")) return "bronchoalveolar_lavage";
  if (s.includes("cerebro") || s.includes("csf")) return "cerebrospinal_fluid";
  if (s.includes("pleural") || s.includes("thoraco")) return "pleural_fluid";
  if (s.includes("synovial") || s.includes("joint")) return "synovial_fluid";
  return rawKey.trim();
}

/**
 * Formats a clean, professional clinical prompt block for the nurse AI.
 */
export function formatBundledTestsForPrompt(
  bundles?: BundledTestsMap | null,
  speciesKey?: string
): string {
  const activeBundles = bundles && Object.keys(bundles).length > 0 ? bundles : getDefaultBundledTests();
  const speciesNote = speciesKey ? ` (${speciesKey.toUpperCase()})` : "";

  const lines: string[] = [
    `STANDARD BUNDLED TEST PROFILES${speciesNote}:`,
    "When the student requests a standard profile or panel, report ONLY the specific parameters belonging to that requested bundle:",
  ];

  for (const [key, tests] of Object.entries(activeBundles)) {
    if (!tests || tests.length === 0) continue;
    const def = STANDARD_BUNDLE_DEFINITIONS.find((d) => d.id === key);
    const label = def ? def.label : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(` • If asked for “${label}”: Report ONLY: ${tests.join(", ")}.`);
  }

  lines.push(
    " • GATED/SPECIFIC TESTS RULE: Add-on tests (e.g. SAA, Troponin, Specific Hormones, Cytologies, Blood Gas, Advanced Imaging) must NEVER be volunteered automatically. The student must demonstrate clinical reasoning by explicitly requesting them by name."
  );

  return lines.join("\n");
}

/**
 * Extracts normalized analyte name sets for /api/live/findings to match against user queries.
 */
export function getPanelAnalytesFromBundles(
  bundles?: BundledTestsMap | null
): Record<string, Set<string>> {
  const activeBundles = bundles && Object.keys(bundles).length > 0 ? bundles : getDefaultBundledTests();
  const result: Record<string, Set<string>> = {};

  for (const [key, tests] of Object.entries(activeBundles)) {
    const normKey = normalizeBundleKey(key);
    const set = result[normKey] ?? new Set<string>();
    for (const t of tests) {
      const clean = t.toLowerCase().trim();
      set.add(clean);
      // Also add acronym inside parentheses e.g. "Red Blood Cell count (RBC)" -> "rbc"
      const parenMatch = t.match(/\(([^)]+)\)/);
      if (parenMatch) {
        set.add(parenMatch[1].toLowerCase().trim());
      }
      // Strip parenthesized portion e.g. "Red Blood Cell count (RBC)" -> "red blood cell count"
      const stripped = t.replace(/\s*\([^)]*\)/g, "").toLowerCase().trim();
      if (stripped && stripped !== clean) {
        set.add(stripped);
      }
    }
    result[normKey] = set;
  }

  // Map common aliases (chem -> biochemistry, cbc -> haematology)
  if (result["haematology"]) {
    result["cbc"] = result["haematology"];
  }
  if (result["biochemistry"]) {
    result["chem"] = result["biochemistry"];
  }

  return result;
}

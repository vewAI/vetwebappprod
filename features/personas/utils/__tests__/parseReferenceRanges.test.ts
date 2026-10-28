import { describe, it, expect } from "vitest";
import { parseReferenceRanges } from "../parseReferenceRanges";

describe("parseReferenceRanges", () => {
  it("parses bracketed reference ranges with bullets and units", () => {
    const text = `
+Red Blood Cell count (RBC) [6.40-10.40x 10^12 cells/L]
+Haematocrit (hct) [0.30-0.47, or 30-47%]
+Haemoglobin [107-165 g/L]
+MCV [41.1-52.4 fl]
+WBC [4.90-11.10 x10^9 cells/L]
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.count).toBe(5);
    expect(res.ranges["Red Blood Cell count (RBC)"]).toBe("6.40-10.40x 10^12 cells/L");
    expect(res.ranges["Haematocrit (hct)"]).toBe("0.30-0.47, or 30-47%");
    expect(res.ranges["Haemoglobin"]).toBe("107-165 g/L");
    expect(res.ranges["MCV"]).toBe("41.1-52.4 fl");
    expect(res.ranges["WBC"]).toBe("4.90-11.10 x10^9 cells/L");
  });

  it("handles colon-separated and bracketed variants with colons", () => {
    const text = `
PCV: [28-44%]
Sodium: 132–146 mmol/L
Potassium: 2.4–5.7 mmol/L
Total plasma protein (or total solids, TPP, TS): [58-77g/L]
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.count).toBe(4);
    expect(res.ranges["PCV"]).toBe("28-44%");
    expect(res.ranges["Sodium"]).toBe("132–146 mmol/L");
    expect(res.ranges["Potassium"]).toBe("2.4–5.7 mmol/L");
    expect(res.ranges["Total plasma protein (or total solids, TPP, TS)"]).toBe("58-77g/L");
  });

  it("handles tab-separated lines copied from spreadsheets", () => {
    const text = [
      "Glucose\t4.0-7.0 mmol/L",
      "Creatine\t70-195 µmol/L",
      "Urea\t3.6-8.9 mmol/L",
    ].join("\n");

    const res = parseReferenceRanges(text);
    expect(res.count).toBe(3);
    expect(res.ranges["Glucose"]).toBe("4.0-7.0 mmol/L");
    expect(res.ranges["Creatine"]).toBe("70-195 µmol/L");
    expect(res.ranges["Urea"]).toBe("3.6-8.9 mmol/L");
  });

  it("handles HTML encoded entities like &gt; and &lt;", () => {
    const text = `
Specific gravity [&gt;1.012]
Ammonia [&lt;90 µmol/L]
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.ranges["Specific gravity"]).toBe(">1.012");
    expect(res.ranges["Ammonia"]).toBe("<90 µmol/L");
  });

  it("captures trailing notes after brackets", () => {
    const text = `
Red blood cells (RBC) [0-5 /HPF] (hpf = high power field)
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.ranges["Red blood cells (RBC)"]).toBe("0-5 /HPF (hpf = high power field)");
  });

  it("correctly skips non-parameter section headings and narratives", () => {
    const text = `
BLOOD/SERUM
- For haematology these are the standard values (values in square brackets represent the reference range):
+Platelets (PLT) [100-250 x10^9 cells/L]
PERITONEAL FLUID
+Total protein [0-25 g/L]
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.count).toBe(2);
    expect(res.ranges["Platelets (PLT)"]).toBe("100-250 x10^9 cells/L");
    expect(res.ranges["Peritoneal Fluid - Total protein"]).toBe("0-25 g/L");
    expect(res.skippedHeaderLines.length).toBeGreaterThanOrEqual(2);

    const flatRes = parseReferenceRanges(text, { prefixSectionHeaders: false });
    expect(flatRes.ranges["Total protein"]).toBe("0-25 g/L");
  });

  it("handles unbracketed numeric ranges (e.g. +Cardiac CK 5.5-32.7%) and typo brackets", () => {
    const text = `
+Cardiac CK (CKMB) 5.5-32.7%
+Testosterone (pre HCG/stallion) 0.5-3.4nmol/L
+gastrin (pre-prandial0 18-72pmol/L]
    `.trim();

    const res = parseReferenceRanges(text);
    expect(res.count).toBe(3);
    expect(res.ranges["Cardiac CK (CKMB)"]).toBe("5.5-32.7%");
    expect(res.ranges["Testosterone (pre HCG/stallion)"]).toBe("0.5-3.4nmol/L");
    expect(res.ranges["gastrin (pre-prandial0"]).toBe("18-72pmol/L");
  });

  it("parses the entire comprehensive veterinary sample provided by Marco with panel prefixes", () => {
    const fullText = `
BLOOD/SERUM
- For haematology these are the standard values (values in square brackets represent the reference range):
+Red Blood Cell count (RBC) [6.40-10.40x 10^12 cells/L]
+Haematocrit (hct) [0.30-0.47, or 30-47%]
+Haemoglobin [107-165 g/L]
+MCV [41.1-52.4 fl]
+MCH [14.1-18.6 pg]
+MCHC [286-328 g/L]
+RDW [26.4-33.3 %]
+WBC [4.90-11.10 x10^9 cells/L]
+Neutrophils [2.50-6.90 x10^9 cells/L]
+Lymphocytes [1.50-5.10 x10^9 cells/L]
+Monocytes [0.20-0.60 x10^9 cells/L]
+Eosinophils [0.00-0.80 x10^9 cells/L]
+Platelets (PLT) [100-250 x10^9 cells/L]

-For biochemistry these are the standard parameters (if any missing - just say not available) (values in square brackets represent the reference range):
+Glucose [4.0-7.0 mmol/L]
+Creatine [70-195 µmol/L]
+Urea [3.6-8.9 mmol/L]
+Calcium [2.60-3.22 mmol/L]
+Sodium [133-150 mmol/L]
+Potassium [3.0-5.3 mmol/L]
+Chloride [97-109 mmol/L]
+Total Protein [56-79 g/L]
+Albumin [19-32 g/L]
+Globulin [24-47 g/L]
+Aspartate aminostransferase (AST) [100-600 IU/L]
+Alkaline phosphatase (ALP) [10-326 IU/L]
+gamma-glutamyltransferase (GGT) [0-87 IU/L]
+LDH [225-700 IU/L]
+total Bilirubin [9-39 µmol/L]
+Creatine Kinase (CK) [10-350 IU/L]

These are reference ranges for further tests that may be requested (each test should be requested specifically by the user and do not provide these results unless specifically asked):
+PCV: [28-44%]
+Total plasma protein (or total solids, TPP, TS): [58-77g/L]
+totalBilirubin [9-39 µmol/L]
+Conjugated bilirubin (direct) [0-10µmol/L]
+Unconjugated bilirubin (indirect) [3-34µmol/L]
+Bile Acids (BA) [<12 µmol/L]
+Triglycerides [ <0.77 mmol/L]
+sorbitol dehydrogenase (SDH) [0-8IU/L]
+Glutamate dehydrogenase (GLDH) [0-12IU/L]
+Alcohol dehydrogenase [6.9-12 IU/L]
+Lactate dehydrogenase (LDH) [225-700IU/L]
+LDH isoenzyme1  [0.1-0.18 proportion of total]
+LDH isoenzyme2  [0.22-0.3 proportion of total]
+LDH isoenzyme3  [0.34-0.42 proportion of total]
+LDH isoenzyme4  [0.13-0.23 proportion of total]
+LDH isoenzyme5  [0.01 0.07 proportion of total]
+Ammonia [<90 µmol/L]
+Serum Amyloid A (SAA) [<20 mg/L]
+Fibrinogen [1-5 g/L]
+Lactate [<2 mmol/L]
+Cardiac troponin I (CTnI) [0.05-0.2 µg/L]
+Cardiac CK (CKMB) 5.5-32.7%
+Ionised Calcium (iCa) [1.45-1.75 mmol/L]
+total Magnesium (Mg) [0.98-1.40mmol/L]
+Magnesium ionised (iMg)[0.98-1.40 mmol/L]
+Osmolarity [279-296mOsmol/Kg]
+Colloid Oncotic pressure [20-22 mmHg]
+Copper (serum) [14-23 µmol/L]
+Copper (plasma) [18-29 µmol/L]
+Selenium [0.7-8.7 µmol/L]
+Zinc [10-16 µmol/L]
+Cadmium [93-441 nmol/L]
+Lead [0.09-0.3µmol/L]
+Phosphorus [1-1.8µmol/L]
+Ferritin (serum) [56.7-86.7 pmol/L]
+Iron serum (Fe) [10-41 µmol/L]
+Total Iron Binding Capacity (TIBC) [25.2-73.2 µmol/L]
+Vitamin E [4600-23500 µmol/L]
+ACTH [<50 pmol/L in August, September and October; <30 pmol/L other time of the year]
+Insulin [0-300 pmol/L]
+Cholesterol [1.9-4.0mmol/L]
+cortisol [80-220nmol/L]
+gastrin (pre-prandial0 18-72pmol/L]
+Aldosterone [0-27pmol/L]
+Arginine vasopressin [0.7-2.3pmol/L]
+Atrial Natriuretic peptide [2-8pmol/L]
+Thyroxin free (fT4) [5-27pmol/L]
+Thyroxine total [5-45pmol/L]
+Tri-iodothyroxine (fT3) [1.5-5.0pmol/L]
+Tri-iodothyroxine total (tT3) [1.0-3.0nmol/l]
+Thyroid stimulating hormone (TSH) [1.6-53.5mIU/L]

Reproduction FEMALE
Progesterone (anestrus/oestrus) [0.5-2nmol/L]
Progesterone (luteal) [10-55nmol/L]
Testosterone (female) [0-0.5nmol/L]
FSH (estrus) [5-18ngml]
FSH (diestrus) [7-40ng/ml]
Luteinizing hormone (LH - estrus) [7.5-20pg/ml]
Luteinizing hormone (LH - diestrus) [0-3.9ng/ml]
Estradiol (estrus) [2.5-8.5pg/ml]
Estradiol (diestrus) [1.36pg/ml]
Estrange sulphate (non-pregnant) [0-0.30ng/ml]
Estrange sulphate (pregnant) [>100ng/ml]
Inhibin [0.1-0.7ng/ml]

Reproduction MALE
+Testosterone (pre HCG/stallion) 0.5-3.4nmol/L
+Testosterone(30 minutes post HCG) [3.5–6.5nmol/L]
+Testosterone(1–2 hours post HCG) [5–8nmol/L]
+Testosterone(castrate) [0–0.8nmol/L]
+Estrone(sulfate (normal male) [5–280nmol/ml]
+Estrone(sulfate (cryptorchid) [0.1–12nmol/ml]
+Estrone(sulfate (castrate) [0–0.03nmol/ml]
+FSH(sexually active stallion) [5–7.7nmol/ml]
+Luteinizing(hormone (sexually active stallion) [4–7nmol/ml]
+Inhibin [0.3–2.3ng/ml]

Arterial blood gas analysis with reference range in square brackets (if arterial blood gas is requested provide all of the following 5 parameters)
+pH [7.36-7.45]
+paO2 [89-115 mmHg]
+paCO2 [37-49 mmHg]
+Base Excess (BE) [-3.2-1 mmol/L]
+Bicarbonate [23-30 mmol/L]

Venous blood gas analysis with reference range in square brackets (if venous blood gas is requested provide all of the following 5 parameters):
+pH [7.33-7.41]
+paO2 [28.7-48.6 mmHg]
+paCO2 [46-64 mmHg]
+Base Excess (BE) [-2 -3 mmol/L]
+Bicarbonate [31.6-37.7 mmol/L]

Coagulation with reference range in square brackets (if coagulation panel is requested provide all of the following 7 parameters):
+Partial Thromboplastin Time (aPTT) [30-50 seconds]
+Prothrombin Time (PT) [10.1-15 seconds]
+Activated Clotting time (ACT) [150-200 seconds]
+Factor VII [198-254%]
+Factor VIII [163-265 %]
+Factor IX [92-206 %]
+Factor X [70-106%]

Serum electrophoresis
Alpha 1 globulin [0.35-2.1g/L]
Alpha 2 globulin [3.1-8.6 g/L]
Beta 1 globulin [3.7-8.7g/L]
Beta 2 globulin [1.5-9.2g/L]
Gamma globulin [4.3-14.2g/L]

PERITONEAL FLUID
Protein [0.-25g/L]
Total nucleated cell count (TNCC) [0-5x10^9/L]
Neutrophil % [20-70%]
Mononuclear cells % [5-60%]
Lymphocytes % [5-60%]
Eosinophils % [0-30%]
Basophils % [0-2%]
Total RBC count [0-0.001x10^12cells/l]
Fibrinogen [0-0.1g/L]

TRACHEAL WASH CYTOLOGY
+Total nucleated cell count [0.1-0.4 x10^9cells/L]
+Neutrophil percent [0-20%]
+Lymphocyte percent [10-40%]
+Macrophage percent [10-60%]
+Mast cell percent [0-2%]
+Eosinophils percent [0-4%]
+Epithelial cell percent [0-20%]

BRONCHOALVEOLAR FLUID CYTOLOGY
+Total nucleated cell count [0.2-0.8 x10^9cells/L]
+Neutrophil percent [0-10%]
+Lymphocyte percent [20-40%]
+Macrophage percent [30-60%]
+Mast cell percent [0-1%]
+Eosinophil percent [0-2%]
+Epithelial cells percent [0-2%]

CEREBROSPINAL FLUID
+Total protein [1-12 g/L]
+Albumin quotient [0.8-2.2%]
+Total nucleated cell count [0-0.05 x10^9cells/L]
+Neutrophil count [0-0.0005 x10^9cells/L]
+Monocyte count [0-0.01 x10^9cells/L]
+Lymphocyte count [0-0.04 x10^9cells/L]
+Total red blood cell count (RBC) [0-55 x10^6cells/L]
+Glucose [1.5-4 mmol/L]
+Lactate [0.1-0.3 mmol/L]
+Creatine kinase [0-10 IU/L]
+Aspartate aminotransferase (AST) [10-60 IU/L]
+Lactate dehydrogenase [0-10 IU/L]
+Sodium [140-150 mmol/L]
+Potassium [2.3-3.5 mmol/L]
+Chloride [90-120 mmol/L]
+Calcium [0.6-1.5 mmol/L]
+Phosphorus [0.1-0.5 mmol/L]
+Urea [0.8-3.3 mmol/L]

PLEURAL FLUID 
+Volume [2-8 mL]
+Total red blood cell (RBC) count [0.02-0.6 x10^9cells/L]
+Total nucleated cell count [0-8 x10^9cells/L]
+Neutrophil count [0.4-11.5 x10^9cells/L]
+Neutrophil percent [30-80 %]
+Lymphocyte count [0-0.7 x10^9cells/L]
+Lymphocytes percent [0-25 %]
+Large mononuclear cell count [0.1-2.8 x10^9cells/L]
+Large mononuclear cell percent [5-66 %]
+Eosinophil count [0-0.2 x10^9cells/L]
+Eosinophil percent [0-5 %]
+Total protein [0-25 g/L]

URINALYSIS
+Urine pH [7-9]
+Specific gravity [&gt;1.012]
+Red blood cells (RBC) [0-5 /HPF] (hpf = high power field)
+White blood cells (WBC) [0-5 /HPF]
+Protein [0]
+Glucose [0]
+Creatinine clearance [1.2-2.5 mL/min/kg]
+Fractional excretion of sodium [0-0.9 %]
+Fractional excretion of potassium [1-80 %]
+Fractional excretion of chloride [0.01-3.5 %]
+Fractional excretion of phosphorus [0.01-6 %]
+Fractional excretion of calcium [0-8 %]
+Fractional excretion of magnesium [20-45 %]
+Gamma-glutamyl transferase (GGT)/creatinine ratio [0-2.9 IU/mmol]
+Corticoid/creatinine ratio [1-7 x10^-6]

SYNOVIAL FLUID ANALYSIS
+Total protein [0-20 g/L]
+Total nucleated cell count [0-0.5 x10^9cells/L]
+Neutrophil percent [0-10 %]
+Mononuclear cells percent [90-100 %]
    `.trim();

    const res = parseReferenceRanges(fullText, { prefixSectionHeaders: true });
    expect(res.count).toBe(196);
    expect(Object.keys(res.ranges).length).toBe(196);
    expect(res.unparsedLines.length).toBe(0);
    expect(res.ranges["CSF - Glucose"]).toBe("1.5-4 mmol/L");
    expect(res.ranges["Glucose"]).toBe("4.0-7.0 mmol/L");
    expect(res.ranges["Urinalysis - Urine pH"]).toBe("7-9");
  });
});

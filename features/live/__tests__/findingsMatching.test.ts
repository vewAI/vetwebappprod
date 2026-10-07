import { describe, expect, it } from "vitest";
import {
  DIAG_SYNONYMS,
  entryMatchesUserText,
  extractDiagPairs,
  findMatchingSynonymKeys,
  isAllLabsRequest,
  isAvailabilityInquiry,
  isGeneralBloodworkRequest,
  labelSpokenIn,
  stageAllowsReveal,
} from "@/app/api/live/findings/route";
import { parseRequestedKeys } from "@/features/chat/services/physFinder";

describe("live findings matching & stage gating", () => {
  describe("Physical exam selectivity (prevent false positive leaks)", () => {
    it("does not match temperature, coronary band, or hoof testers when asking about respiratory and heart rate", () => {
      const userText = "So about respiratory and heart rate.";

      // 1. Canonical keys from user text
      const requested = parseRequestedKeys(userText);
      expect(requested.canonical).toEqual(["respiratory_rate", "heart_rate"]);
      expect(requested.canonical).not.toContain("temperature");

      // 2. Vocabulary match on coronary band and hoof testers
      expect(entryMatchesUserText("No pain response on pressure of coronary band", userText)).toBe(false);
      expect(entryMatchesUserText("Hoof testers are negative (no pain response).", userText)).toBe(false);
      expect(entryMatchesUserText("Temperature", userText)).toBe(false);

      // 3. Vocabulary match on legitimate vitals
      expect(entryMatchesUserText("Respiratory rate", userText)).toBe(true);
      expect(entryMatchesUserText("Heart rate", userText)).toBe(true);
    });

    it("does not leak multi-word auscultation or coronary findings from assistant spoken vitals", () => {
      const spokenAssistant = "The respiratory rate is 16 breaths per minute and the heart rate is 40 beats per minute.";

      expect(labelSpokenIn("Respiratory rate", spokenAssistant)).toBe(true);
      expect(labelSpokenIn("Heart rate", spokenAssistant)).toBe(true);

      // Multi-word auscultation entry should NOT match just because "respiratory" was spoken
      expect(
        labelSpokenIn("Respiratory auscultation without and with rebreathing bag", spokenAssistant)
      ).toBe(false);

      // Coronary band should NOT match
      expect(labelSpokenIn("Coronary band", spokenAssistant)).toBe(false);
      expect(labelSpokenIn("Hoof testers", spokenAssistant)).toBe(false);
    });
  });

  describe("Laboratory availability inquiries vs requests", () => {
    it("detects availability inquiries and does not match specific diagnostic groups", () => {
      const inquiry = "What labs do we have, Martin?";
      expect(isAvailabilityInquiry(inquiry)).toBe(true);
      expect(isAllLabsRequest(inquiry)).toBe(false);
      expect(isGeneralBloodworkRequest(inquiry)).toBe(false);

      const matchedKeys = findMatchingSynonymKeys(inquiry, DIAG_SYNONYMS);
      expect(matchedKeys.size).toBe(0);
    });

    it("detects explicit 'all labs' requests", () => {
      expect(isAllLabsRequest("Show all results")).toBe(true);
      expect(isAllLabsRequest("Run all labs")).toBe(true);
      expect(isAllLabsRequest("Can we get all the diagnostic tests?")).toBe(true);
      expect(isAllLabsRequest("Show me haematology")).toBe(false);
    });

    it("detects general blood work requests", () => {
      expect(isGeneralBloodworkRequest("Can we run blood work?")).toBe(true);
      expect(isGeneralBloodworkRequest("Let's do the routine bloods")).toBe(true);
      expect(isGeneralBloodworkRequest("What labs do we have?")).toBe(false);
    });
  });

  describe("Selective diagnostic test release", () => {
    const caseDiagText = `
Haematology: WBC 14.5 x10^9/L (mild leukocytosis with neutrophilia), RBC 7.8 x10^12/L
Biochemistry: Total Protein 78 g/L, Albumin 32 g/L, ALP 120 U/L
Lactate: 4.2 mmol/L (elevated)
PCV/TPP: PCV 42%, TPP 75 g/L
Urinalysis: Specific gravity 1.030, pH 7.0, protein negative
Abdominal radiographs: Gas distension of the large colon with ventral displacement
`;

    it("extracts individual diagnostic entries correctly", () => {
      const entries = extractDiagPairs(caseDiagText);
      const labels = entries.map((e) => e.label);
      expect(labels).toContain("Haematology");
      expect(labels).toContain("Biochemistry");
      expect(labels).toContain("Lactate");
      expect(labels).toContain("PCV/TPP");
      expect(labels).toContain("Urinalysis");
      expect(labels).toContain("Abdominal radiographs");
    });

    it("selectively matches only the requested test (e.g. Haematology only)", () => {
      const entries = extractDiagPairs(caseDiagText);
      const userText = "Please show me the haematology";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);
      expect(userKeys.has("cbc")).toBe(true);
      expect(userKeys.has("chem")).toBe(false);

      const matchedEntries = entries.filter((entry) => {
        const entryKeys = findMatchingSynonymKeys(entry.label, DIAG_SYNONYMS);
        const keyHit = [...entryKeys].some((k) => userKeys.has(k));
        const vocabHit = entryMatchesUserText(entry.label, userText);
        return keyHit || vocabHit;
      });

      expect(matchedEntries.map((e) => e.label)).toEqual(["Haematology"]);
    });

    it("selectively matches both Haematology and Biochemistry when both are requested", () => {
      const entries = extractDiagPairs(caseDiagText);
      const userText = "Can we see both haematology and biochemistry?";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);

      const matchedEntries = entries.filter((entry) => {
        const entryKeys = findMatchingSynonymKeys(entry.label, DIAG_SYNONYMS);
        const keyHit = [...entryKeys].some((k) => userKeys.has(k));
        const vocabHit = entryMatchesUserText(entry.label, userText);
        return keyHit || vocabHit;
      });

      expect(matchedEntries.map((e) => e.label)).toEqual(["Haematology", "Biochemistry"]);
    });

    it("general bloodwork request includes haematology, biochemistry, and PCV/TPP, but NOT urinalysis or radiographs", () => {
      const entries = extractDiagPairs(caseDiagText);
      const userText = "Let's check the blood work";
      const isBloodwork = isGeneralBloodworkRequest(userText);
      expect(isBloodwork).toBe(true);

      const matchedEntries = entries.filter((entry) => {
        const entryKeys = findMatchingSynonymKeys(entry.label, DIAG_SYNONYMS);
        const bloodworkHit =
          isBloodwork &&
          (entryKeys.has("cbc") || entryKeys.has("chem") || entryKeys.has("pcv_tpp"));
        return bloodworkHit;
      });

      const matchedLabels = matchedEntries.map((e) => e.label);
      expect(matchedLabels).toContain("Haematology");
      expect(matchedLabels).toContain("Biochemistry");
      expect(matchedLabels).toContain("PCV/TPP");
      expect(matchedLabels).not.toContain("Urinalysis");
      expect(matchedLabels).not.toContain("Abdominal radiographs");
    });
  });

  describe("Stage gating", () => {
    it("never reveals diagnostic findings during physical examination or history", () => {
      expect(stageAllowsReveal("diagnostic", "physical")).toBe(false);
      expect(stageAllowsReveal("diagnostic", "history")).toBe(false);
      expect(stageAllowsReveal("diagnostic", "treatment")).toBe(false);
      expect(stageAllowsReveal("diagnostic", "laboratory")).toBe(true);
    });

    it("never reveals physical findings during history or laboratory stage", () => {
      expect(stageAllowsReveal("physical", "history")).toBe(false);
      expect(stageAllowsReveal("physical", "laboratory")).toBe(false);
      expect(stageAllowsReveal("physical", "physical")).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  DIAG_SYNONYMS,
  EQUINE_NORMAL_PHYSICAL_BASELINES,
  canonicalKeysForLabel,
  entryMatchesUserText,
  extractFindingsEntries,
  extractFindingsFromDescription,
  extractFindingsFromDetails,
  extractDiagPairs,
  findMatchingSynonymKeys,
  isAllLabsRequest,
  isAvailabilityInquiry,
  isGarbageEntry,
  isGeneralBloodworkRequest,
  labelSpokenIn,
  matchDiagnosticFinding,
  physicalEntryMatchesUserText,
  splitCompoundEntries,
  stageAllowsReveal,
} from "@/app/api/live/findings/route";
import { parseRequestedKeys } from "@/features/chat/services/physFinder";
import { resolveLiveStageType } from "@/features/live/utils/normalizeStageType";

describe("live findings matching & stage gating", () => {
  describe("Physical exam selectivity (prevent false positive leaks)", () => {
    it("keeps mucous membranes, CRT and respiratory auscultation as separate requests", () => {
      const request = "Heart rate, respiratory rate and mucous membranes, please";
      const keys = parseRequestedKeys(request).canonical;

      expect(keys).toContain("mucous_membranes");
      expect(keys).not.toContain("capillary_refill_time");
      expect(canonicalKeysForLabel("Capillary refill time")).toEqual(["capillary_refill_time"]);
      expect(canonicalKeysForLabel("Respiratory auscultation")).toEqual(["thoracic_auscultation"]);
      expect(physicalEntryMatchesUserText("Respiratory auscultation", request)).toBe(false);
      expect(physicalEntryMatchesUserText("Respiratory rate", request)).toBe(true);
      expect(parseRequestedKeys("Please check CRT").canonical).toContain("capillary_refill_time");
      expect(canonicalKeysForLabel("Gut sounds (gastrointestinal borborygmi)")).toContain("abdomen");
      expect(parseRequestedKeys("Please check gut sounds").canonical).toContain("abdomen");
      expect(canonicalKeysForLabel("Gastrointestinal borborygmi")).toContain("abdomen");
    });

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

    it("matches all 5 requested physical parameters when student asks for heart rate, respiration, gut sounds, rectal temperature, and palpating the muscles", () => {
      const userText = "Could you check the heart rate, respiration, gut sounds, and rectal temperature, as well as palpating the muscles?";
      const requested = parseRequestedKeys(userText);

      expect(requested.canonical).toContain("heart_rate");
      expect(requested.canonical).toContain("respiratory_rate");
      expect(requested.canonical).toContain("abdomen");
      expect(requested.canonical).toContain("temperature");
      expect(requested.canonical).toContain("musculoskeletal");

      expect(physicalEntryMatchesUserText("Heart rate", userText)).toBe(true);
      expect(physicalEntryMatchesUserText("Respiratory rate", userText)).toBe(true);
      expect(physicalEntryMatchesUserText("Gut sounds", userText)).toBe(true);
      expect(physicalEntryMatchesUserText("Rectal temperature", userText)).toBe(true);
      expect(physicalEntryMatchesUserText("Musculoskeletal", userText)).toBe(true);
      expect(physicalEntryMatchesUserText("Muscle palpation", userText)).toBe(true);
      expect(canonicalKeysForLabel("Musculoskeletal")).toContain("musculoskeletal");
      expect(canonicalKeysForLabel("Musculoskeletal (muscles)")).toContain("musculoskeletal");
    });

    it("correctly handles digital pulses as an independent parameter without leaking heart rate", () => {
      const digitalPulseReq = "Can you check the digital pulses?";
      const parsed = parseRequestedKeys(digitalPulseReq);

      expect(parsed.canonical).toContain("digital_pulse");
      expect(parsed.canonical).not.toContain("heart_rate");

      expect(canonicalKeysForLabel("Digital pulses")).toEqual(["digital_pulse"]);
      expect(canonicalKeysForLabel("Digital pulse")).toEqual(["digital_pulse"]);
      expect(canonicalKeysForLabel("Palmar digital pulse")).toEqual(["digital_pulse"]);
      expect(canonicalKeysForLabel("Heart rate")).toEqual(["heart_rate"]);

      expect(physicalEntryMatchesUserText("Digital pulses", digitalPulseReq)).toBe(true);
      expect(physicalEntryMatchesUserText("Hooves & digital pulses", digitalPulseReq)).toBe(true);
      expect(physicalEntryMatchesUserText("Heart rate", digitalPulseReq)).toBe(false);
    });

    it("matches muscle palpation across compound labels and typo variations", () => {
      expect(parseRequestedKeys("muscle palpation").canonical).toContain("musculoskeletal");
      expect(parseRequestedKeys("muscle pa;pation").canonical).toContain("musculoskeletal");
      expect(parseRequestedKeys("palpating the muscles").canonical).toContain("musculoskeletal");

      expect(canonicalKeysForLabel("Muscle tone / palpation")).toContain("musculoskeletal");
      expect(canonicalKeysForLabel("Epaxial muscles")).toContain("musculoskeletal");

      expect(physicalEntryMatchesUserText("Muscle tone / palpation", "muscle palpation")).toBe(true);
      expect(physicalEntryMatchesUserText("Epaxial muscles", "palpating the muscles")).toBe(true);
    });

    it("preserves all 5 canonical keys across multi-turn accumulated history", () => {
      const multiTurnText = "HR and RR, temperature, HR and RR, digital pulses, muscle palpation";
      const parsed = parseRequestedKeys(multiTurnText);

      expect(parsed.canonical).toContain("heart_rate");
      expect(parsed.canonical).toContain("respiratory_rate");
      expect(parsed.canonical).toContain("temperature");
      expect(parsed.canonical).toContain("digital_pulse");
      expect(parsed.canonical).toContain("musculoskeletal");

      // Also verify when joined with newlines
      const newlineText = "HR and RR\ntemperature\nHR and RR\ndigital pulses\nmuscle palpation";
      const parsedNewline = parseRequestedKeys(newlineText);

      expect(parsedNewline.canonical).toContain("heart_rate");
      expect(parsedNewline.canonical).toContain("respiratory_rate");
      expect(parsedNewline.canonical).toContain("temperature");
      expect(parsedNewline.canonical).toContain("digital_pulse");
      expect(parsedNewline.canonical).toContain("musculoskeletal");
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
      expect(isGeneralBloodworkRequest("Can we run blood tests?")).toBe(true);
      expect(isGeneralBloodworkRequest("I would like blood tests please")).toBe(true);
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

    it("matches requested short analyte names in a case laboratory table", () => {
      const entries = extractDiagPairs(`| Test | Analyte | Value | Units | Reference Range | Note |
| --- | --- | --- | --- | --- | --- |
| Biochemistry | CK | Approximately 15% above reference interval | | Not supplied | Day 1 |
| Biochemistry | AST | Unremarkable | | Not supplied | Day 1 |
| Urinalysis | USG | 1.045 | | Not supplied | Day 1 |`);
      const request = "Please show me CK and USG";
      const keys = findMatchingSynonymKeys(request, DIAG_SYNONYMS);
      const matched = entries.filter((entry) => matchDiagnosticFinding(entry, keys, request, false, false));

      expect(matched.map((entry) => entry.label)).toEqual(["CK", "USG"]);
    });

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

    it("matches all biochemistry analytes when student asks 'Tell me biochemistry.'", () => {
      const case4DiagText = `{
        "blood_BHB" or "beta-hydroxybutyrate": "3.5 mmol/L",
        "urine_ketone_bodies": "++ (moderate ketonuria)",
        "bloodwork": {
          "potassium": "3.2 mmol/L (low)",
          "chloride": "90 mmol/L (low-normal)",
          "calcium": "2.1 mmol/L (low)",
          "haematology": "mild neutrophilia otherwise normal",
          "glucose": "normal",
          "AST": "elevated",
          "PCV": "51%"
        },
        "ultrasound_left_side": {
          "dorsal_findings": "Gas cap",
          "ventral_findings": "Echogenic ingesta"
        }
      }`;

      const entries = extractDiagPairs(case4DiagText);
      const userText = "Tell me biochemistry.";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);
      const isBloodwork = isGeneralBloodworkRequest(userText);
      const isAll = isAllLabsRequest(userText);

      const matched = entries.filter((e) => matchDiagnosticFinding(e, userKeys, userText, isAll, isBloodwork));
      const labels = matched.map((m) => m.label.toLowerCase());

      expect(labels).toContain("potassium");
      expect(labels).toContain("chloride");
      expect(labels).toContain("calcium");
      expect(labels).toContain("glucose");
      expect(labels).toContain("ast");
      expect(labels).toContain("beta-hydroxybutyrate");
      expect(labels).not.toContain("dorsal findings");
      expect(labels).not.toContain("urine ketone bodies");
    });

    it("matches only calcium when student asks 'Check calcium'", () => {
      const case4DiagText = `{
        "bloodwork": {
          "potassium": "3.2 mmol/L (low)",
          "calcium": "2.1 mmol/L (low)",
          "glucose": "normal"
        }
      }`;
      const entries = extractDiagPairs(case4DiagText);
      const userText = "Check calcium";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);
      const isBloodwork = isGeneralBloodworkRequest(userText);
      const isAll = isAllLabsRequest(userText);

      const matched = entries.filter((e) => matchDiagnosticFinding(e, userKeys, userText, isAll, isBloodwork));
      expect(matched.map((m) => m.label)).toEqual(["calcium"]);
    });

    it("matches ultrasound findings when student asks for ultrasound", () => {
      const case4DiagText = `{
        "ultrasound_left_side": {
          "dorsal_findings": "Gas cap with reverberation artefacts",
          "ventral_findings": "Echogenic ingesta with abomasal folds"
        }
      }`;
      const entries = extractDiagPairs(case4DiagText);
      const userText = "Can we do an ultrasound?";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);
      const isBloodwork = isGeneralBloodworkRequest(userText);
      const isAll = isAllLabsRequest(userText);

      const matched = entries.filter((e) => matchDiagnosticFinding(e, userKeys, userText, isAll, isBloodwork));
      expect(matched.map((m) => m.label)).toEqual(["dorsal findings", "ventral findings"]);
    });

    it("matches all bloodwork analytes including un-categorized CK, AST, Urea, Creatinine when student asks for 'blood tests'", () => {
      const bloodworkCaseText = `
        CK: 4500 U/L [high]
        AST: 850 U/L [high]
        Urea: 7.2 mmol/L
        Creatinine: 110 umol/L
        Total Protein: 68 g/L
        Albumin: 32 g/L
        Abdominal Ultrasound: Normal peritoneal space, no free fluid
      `;
      const entries = extractDiagPairs(bloodworkCaseText);
      const userText = "Can we run blood tests, please?";
      const userKeys = findMatchingSynonymKeys(userText, DIAG_SYNONYMS);
      const isBloodwork = isGeneralBloodworkRequest(userText);
      const isAll = isAllLabsRequest(userText);

      expect(isBloodwork).toBe(true);

      const matched = entries.filter((e) => matchDiagnosticFinding(e, userKeys, userText, isAll, isBloodwork));
      const matchedLabels = matched.map((m) => m.label.toLowerCase());

      expect(matchedLabels).toContain("ck");
      expect(matchedLabels).toContain("ast");
      expect(matchedLabels).toContain("urea");
      expect(matchedLabels).toContain("creatinine");
      expect(matchedLabels).toContain("total protein");
      expect(matchedLabels).toContain("albumin");
      expect(matchedLabels).not.toContain("abdominal ultrasound");
    });
  });

  describe("Stage gating", () => {
    it("treats a clearly named laboratory stage as laboratory despite stale diagnostic metadata", () => {
      expect(resolveLiveStageType({
        title: "Laboratory & Tests",
        description: "Request diagnostics, imaging, and lab outputs",
        settings: { stage_type: "diagnostic" },
      })).toBe("laboratory");
      expect(resolveLiveStageType({
        title: "Laboratory & Tests",
        description: "Request diagnostics, imaging, and lab outputs",
        settings: {},
      })).toBe("laboratory");
      expect(resolveLiveStageType({
        title: "Diagnostic Planning",
        description: "Explain planned tests",
        settings: {},
      })).toBe("diagnostic");
    });

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
  describe("Structured Case Submission fallback and ASR tolerance", () => {
    it("tolerates common ASR phonetic mis-transcriptions for vitals (e.g. 'age Aaron RR')", () => {
      const requested = parseRequestedKeys("Um, tell me age Aaron RR.");
      expect(requested.canonical).toContain("heart_rate");
      expect(requested.canonical).toContain("respiratory_rate");
    });

    it("extracts physical and diagnostic sections from structured case details", () => {
      const sampleDetails = `
1 Case and teaching purpose
Author: Marco Duz
4 Physical examination
4.3  Heart rate HR in beats per minute
66 beats/min.
4.4  Respiratory rate RR in breaths per minute
14 breaths/min.
4.5  Temperature in degrees Celsius; site or method
38.1 °C, rectal.
5 Diagnostics and results
5.4  Admission CBC
RBC 9.5 x10^12/L [6.4-10.4], WBC 12.2 x10^9/L
6 Diagnosis and treatment decisions
Final diagnosis: Larval cyathostominosis
`;
      const extracted = extractFindingsFromDetails(sampleDetails);
      expect(extracted.physical).toContain("Heart rate: 66 beats/min.");
      expect(extracted.physical).toContain("Respiratory rate: 14 breaths/min.");
      expect(extracted.physical).toContain("Temperature: 38.1 °C, rectal.");
      expect(extracted.diagnostic).toContain("Admission CBC: RBC 9.5 x10^12/L");
    });
  });

  describe("Equine pulse separation & compound vitals splitting", () => {
    it("strictly separates heart_rate, peripheral pulse, and digital_pulse requests", () => {
      // 1. Asking for heart rate only
      const hrReq = parseRequestedKeys("What is the heart rate?");
      expect(hrReq.canonical).toContain("heart_rate");
      expect(hrReq.canonical).not.toContain("pulse");
      expect(hrReq.canonical).not.toContain("digital_pulse");

      // 2. Asking for peripheral pulses only
      const pulseReq = parseRequestedKeys("Can you check the pulses?");
      expect(pulseReq.canonical).toContain("pulse");
      expect(pulseReq.canonical).not.toContain("digital_pulse");
      expect(pulseReq.canonical).not.toContain("heart_rate");

      const periphPulseReq = parseRequestedKeys("Check the peripheral pulse quality and facial artery pulse");
      expect(periphPulseReq.canonical).toContain("pulse");
      expect(periphPulseReq.canonical).not.toContain("digital_pulse");

      // 3. Asking for digital pulses only
      const digReq = parseRequestedKeys("Please check digital pulses");
      expect(digReq.canonical).toContain("digital_pulse");
      expect(digReq.canonical).not.toContain("pulse");
      expect(digReq.canonical).not.toContain("heart_rate");

      // Canonical label mappings
      expect(canonicalKeysForLabel("Heart rate")).toEqual(["heart_rate"]);
      expect(canonicalKeysForLabel("Pulse")).toEqual(["pulse"]);
      expect(canonicalKeysForLabel("Peripheral pulse")).toEqual(["pulse"]);
      expect(canonicalKeysForLabel("Digital pulse")).toEqual(["digital_pulse"]);
      expect(canonicalKeysForLabel("Digital pulses")).toEqual(["digital_pulse"]);

      // Vocabulary matching mutual exclusion
      expect(physicalEntryMatchesUserText("Pulse", "What is the heart rate?")).toBe(false);
      expect(physicalEntryMatchesUserText("Digital pulse", "What is the heart rate?")).toBe(false);
      expect(physicalEntryMatchesUserText("Heart rate", "Can you check the pulses?")).toBe(false);
      expect(physicalEntryMatchesUserText("Digital pulse", "Can you check the pulses?")).toBe(false);
      expect(physicalEntryMatchesUserText("Pulse", "Please check digital pulses")).toBe(false);
      expect(physicalEntryMatchesUserText("Digital pulse", "Please check digital pulses")).toBe(true);
    });

    it("splits compound vitals so heart rate does not group pulses with HR", () => {
      const compoundText = "Heart rate: 44 bpm, pulses strong and synchronous";
      const entries = extractFindingsEntries(compoundText);

      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ label: "Heart rate", value: "44 bpm" });
      expect(entries[1]).toEqual({ label: "Pulse", value: "strong and synchronous" });
    });

    it("splits three-way compound findings with digital pulses into separate lines", () => {
      const compoundThree = "Heart rate: 44 bpm, peripheral pulses strong and regular, digital pulses faint and equal";
      const entries = extractFindingsEntries(compoundThree);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({ label: "Heart rate", value: "44 bpm" });
      expect(entries[1]).toEqual({ label: "Peripheral pulse", value: "strong and regular" });
      expect(entries[2]).toEqual({ label: "Digital pulse", value: "faint and equal" });
    });

    it("extracts muscle palpation from narrative case description when authored there", () => {
      const caseDescription =
        "Cerveso is a 9-year-old gelding presenting with acute reluctance to move after a 2-hour hack. The epaxial and gluteal muscles are hard and painful on palpation. Heart rate is 44 bpm.";
      const extracted = extractFindingsFromDescription(caseDescription);

      expect(extracted.length).toBeGreaterThanOrEqual(1);
      const muscleFinding = extracted.find((e) => e.label.includes("Muscle"));
      expect(muscleFinding).toBeDefined();
      expect(muscleFinding?.value).toContain("hard and painful on palpation");

      const gaitFinding = extracted.find((e) => e.label.includes("Gait"));
      expect(gaitFinding).toBeDefined();
      expect(gaitFinding?.value).toContain("reluctance to move");
    });

    it("does not reject clinical labels containing forward slashes in isGarbageEntry", () => {
      expect(isGarbageEntry("Musculoskeletal / Muscle palpation", "firm and painful")).toBe(false);
      expect(isGarbageEntry("Muscle tone / palpation", "tense")).toBe(false);
      expect(isGarbageEntry("PCV / TP", "42% / 7.2 g/dL")).toBe(false);
      expect(isGarbageEntry("Gait / Locomotion", "stiff")).toBe(false);

      // Web URLs or questions should still be identified as garbage
      expect(isGarbageEntry("https://example.com/file", "data")).toBe(true);
      expect(isGarbageEntry("Question", "Which specific test do you want to know about?")).toBe(true);
    });

    it("provides equine normal reference baselines for unauthored parameters", () => {
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.digital_pulse).toBeDefined();
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.digital_pulse.value).toContain("faint");
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.pulse).toBeDefined();
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.pulse.value).toContain("Strong, regular, synchronous");
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.gut_sounds).toBeDefined();
      expect(EQUINE_NORMAL_PHYSICAL_BASELINES.musculoskeletal).toBeDefined();
    });

    it("ensures physical exam panel starts empty and greetings never leak vitals", () => {
      // Greetings or conversational introductions should yield 0 canonical keys
      expect(parseRequestedKeys("Hi Amanda, I am ready to start.").canonical).toEqual([]);
      expect(parseRequestedKeys("Let us begin the physical examination.").canonical).toEqual([]);

      // Non-requested vitals must not match
      expect(physicalEntryMatchesUserText("Heart rate", "Hi Amanda, I am ready to start.")).toBe(false);
      expect(physicalEntryMatchesUserText("Pulse", "Hi Amanda, I am ready to start.")).toBe(false);
      expect(physicalEntryMatchesUserText("Digital pulse", "Hi Amanda, I am ready to start.")).toBe(false);
      expect(physicalEntryMatchesUserText("Respiratory rate", "Let us begin the physical examination.")).toBe(false);
      expect(physicalEntryMatchesUserText("Temperature", "Let us begin the physical examination.")).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { buildPersonaSystemInstruction } from "../systemInstructionBuilder";

const caseItem: Case = {
  id: "case-1",
  title: "Horse case",
  description: "A clinical communication case",
  species: "Horse",
  condition: "Lameness",
  category: "Equine",
  difficulty: "Easy",
  estimatedTime: 10,
  imageUrl: "",
};

const stage: Stage = {
  id: "stage-1",
  title: "History Taking",
  description: "Take the history",
  completed: false,
  role: "owner",
  settings: { stage_type: "history" },
};

describe("buildPersonaSystemInstruction", () => {
  it.each(["owner", "veterinary-nurse", "lab-technician"])(
    "includes the British accent directive for %s",
    (personaRoleKey) => {
      const result = buildPersonaSystemInstruction({
        caseItem,
        stage,
        personaRoleKey,
      });

      expect(result.systemInstruction).toContain("British English accent");
      expect(result.systemInstruction).toContain("Received Pronunciation");
    },
  );

  it("includes the classic shared guideline and role-info stage contract", () => {
    const result = buildPersonaSystemInstruction({
      caseItem,
      stage: {
        ...stage,
        roleInfoKey: "getOwnerPrompt",
      },
      personaRoleKey: "owner",
      persona: {
        displayName: "Maria Smith",
        behaviorPrompt: "You are worried but cooperative and answer in plain language.",
      },
    });

    expect(result.systemInstruction).toContain("SHARED CLASSIC CHAT GUIDELINES");
    expect(result.systemInstruction).toContain("CLASSIC ROLE-INFO LAYER (getOwnerPrompt)");
    expect(result.systemInstruction).toContain("You are worried but cooperative");

    const stagePromptResult = buildPersonaSystemInstruction({
      caseItem,
      stage: {
        ...stage,
        roleInfoKey: "getOwnerPrompt",
        stagePrompt: "Open with the presenting complaint, then wait for the student's questions.",
      },
      personaRoleKey: "owner",
    });
    expect(stagePromptResult.systemInstruction).toContain("Open with the presenting complaint");
    expect(stagePromptResult.systemInstruction).not.toContain("CLASSIC ROLE-INFO LAYER (getOwnerPrompt)");
    expect(result.systemInstruction).toContain("PERSONA IDENTITY (STRICT)");
  });

  it("omits diagnostic findings from clinical data during history and physical exam stages", () => {
    const caseWithBoth: Case = {
      ...caseItem,
      physicalExamFindings: "Heart rate: 40 bpm\nRespiratory rate: 16 bpm",
      diagnosticFindings: "Haematology: Normal\nBiochemistry: Elevated lactate",
    };

    const physicalResult = buildPersonaSystemInstruction({
      caseItem: caseWithBoth,
      stage: {
        ...stage,
        id: "stage-2",
        title: "Physical Examination",
        settings: { stage_type: "physical" },
      },
      personaRoleKey: "veterinary-nurse",
    });

    expect(physicalResult.systemInstruction).toContain("Physical Examination Findings:");
    expect(physicalResult.systemInstruction).toContain("Heart rate: 40 bpm");
    expect(physicalResult.systemInstruction).not.toContain("Diagnostic/Lab Results:");
    expect(physicalResult.systemInstruction).not.toContain("Elevated lactate");
    expect(physicalResult.systemInstruction).toContain("STAGE BOUNDARY - NO LABS YET");

    const labResult = buildPersonaSystemInstruction({
      caseItem: caseWithBoth,
      stage: {
        ...stage,
        id: "stage-3",
        title: "Laboratory Tests",
        settings: { stage_type: "laboratory" },
      },
      personaRoleKey: "veterinary-nurse",
    });

    expect(labResult.systemInstruction).toContain("Diagnostic/Lab Results:");
    expect(labResult.systemInstruction).toContain("Elevated lactate");
  });

  describe("difficulty-based clinical reasoning guidance for veterinary nurse", () => {
    it("scaffolds student reasoning with Socratic cues when difficulty is Easy", () => {
      const easyResult = buildPersonaSystemInstruction({
        caseItem: { ...caseItem, difficulty: "Easy" },
        stage: { ...stage, settings: { stage_type: "physical" } },
        personaRoleKey: "veterinary-nurse",
      });

      expect(easyResult.systemInstruction).toContain("CLINICAL REASONING GUIDANCE (EARLY-YEAR / NOVICE STUDENT SCAFFOLDING)");
      expect(easyResult.systemInstruction).toContain("SOCRATIC QUESTIONS");
      expect(easyResult.systemInstruction).toContain("What specific body system or differential are you prioritizing");
      expect(easyResult.systemInstruction).toContain("NON-SPOILER GUARDRAIL");
      expect(easyResult.systemInstruction).toContain("CLINICAL REASONING SCAFFOLDING (EASY DIFFICULTY)");
    });

    it("provides standard professional assistance when difficulty is Medium", () => {
      const mediumResult = buildPersonaSystemInstruction({
        caseItem: { ...caseItem, difficulty: "Medium" },
        stage: { ...stage, settings: { stage_type: "physical" } },
        personaRoleKey: "veterinary-nurse",
      });

      expect(mediumResult.systemInstruction).toContain("CLINICAL REASONING GUIDANCE (INTERMEDIATE CLINICAL PRACTICE)");
      expect(mediumResult.systemInstruction).toContain("standard professional clinical assistance");
      expect(mediumResult.systemInstruction).not.toContain("EARLY-YEAR / NOVICE");
    });

    it("enforces strict exam neutrality and no hints when difficulty is Hard", () => {
      const hardResult = buildPersonaSystemInstruction({
        caseItem: { ...caseItem, difficulty: "Hard" },
        stage: { ...stage, settings: { stage_type: "physical" } },
        personaRoleKey: "veterinary-nurse",
      });

      expect(hardResult.systemInstruction).toContain("CLINICAL REASONING GUIDANCE (ADVANCED / EXAM SIMULATION)");
      expect(hardResult.systemInstruction).toContain("STRICT NEUTRALITY");
      expect(hardResult.systemInstruction).toContain("EXAM CONDITIONS (HARD DIFFICULTY)");
      expect(hardResult.systemInstruction).not.toContain("SOCRATIC QUESTIONS");
    });

    it("does not include nurse clinical reasoning guidance for non-clinical roles (owner)", () => {
      const ownerResult = buildPersonaSystemInstruction({
        caseItem: { ...caseItem, difficulty: "Easy" },
        stage: { ...stage, settings: { stage_type: "history" } },
        personaRoleKey: "owner",
      });

      expect(ownerResult.systemInstruction).not.toContain("CLINICAL REASONING GUIDANCE");
      expect(ownerResult.systemInstruction).not.toContain("SOCRATIC QUESTIONS");
    });
  });
});

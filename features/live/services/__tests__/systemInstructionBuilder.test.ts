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
});

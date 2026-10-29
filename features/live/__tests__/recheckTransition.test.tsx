import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import { usePersonaSwitcher } from "../hooks/usePersonaSwitcher";

const caseItem: Case = {
  id: "recheck-case",
  title: "Recheck case",
  description: "A horse returns for reassessment.",
  species: "Horse",
  condition: "Illness",
  category: "Equine",
  difficulty: "Easy",
  estimatedTime: 20,
  imageUrl: "",
};

const stages: Stage[] = [
  {
    id: "notice",
    title: "Recheck transition",
    description: "",
    completed: false,
    role: "Recheck notice",
    personaRoleKey: "owner",
    transitionMessage: "Four days later, speak to the nurse.",
    settings: { stage_type: "recheck_transition" },
  },
  {
    id: "nurse",
    title: "Recheck examination",
    description: "Ask for the repeat examination findings.",
    completed: false,
    role: "Veterinary Nurse",
    personaRoleKey: "veterinary-nurse",
    settings: { stage_type: "physical" },
  },
];

function activePersonaAt(index: number, sequence = stages) {
  function Probe() {
    const roleKey = usePersonaSwitcher(caseItem, sequence, index, {})?.roleKey ?? "";
    return <span data-role={roleKey} />;
  }
  const markup = renderToStaticMarkup(<Probe />);
  return markup.match(/data-role="([^"]*)"/)?.[1] || null;
}

describe("recheck transition voice routing", () => {
  it("does not create a speaking persona for the written notice", () => {
    expect(activePersonaAt(0)).toBeNull();
  });

  it("uses the next stage's configured nurse after the notice", () => {
    expect(activePersonaAt(1)).toBe("veterinary-nurse");
  });

  it("uses the owner when the following recheck stage is an owner encounter", () => {
    const ownerStage: Stage = {
      ...stages[1],
      id: "owner",
      title: "Owner recheck",
      role: "Client (Horse Owner)",
      personaRoleKey: "owner",
      settings: { stage_type: "history" },
    };
    expect(activePersonaAt(1, [stages[0], ownerStage])).toBe("owner");
  });
});

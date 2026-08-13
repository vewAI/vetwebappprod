import { describe, expect, it } from "vitest";
import type { Stage } from "@/features/stages/types";
import { resolveLivePersonaRoleKey } from "../resolveLivePersonaRoleKey";

function stage(overrides: Partial<Stage>): Stage {
  return {
    id: "stage-1",
    title: "Custom stage",
    description: "",
    completed: false,
    role: "",
    ...overrides,
  };
}

describe("resolveLivePersonaRoleKey", () => {
  it("uses the stage type mapping first", () => {
    expect(resolveLivePersonaRoleKey(stage({
      title: "History Taking",
      settings: { stage_type: "history" },
      personaRoleKey: "veterinary-nurse",
    }))).toBe("owner");
  });

  it("infers owner from a history stage when type metadata is missing", () => {
    expect(resolveLivePersonaRoleKey(stage({ title: "History Taking" }))).toBe("owner");
  });

  it("falls back to the database persona for custom stages", () => {
    expect(resolveLivePersonaRoleKey(stage({ personaRoleKey: "lab-technician" }))).toBe("lab-technician");
  });
});

import assert from "assert";
import { describe, it } from "vitest";
import type { Stage } from "@/features/stages/types";
import { resolveLivePersonaRoleKey } from "../utils/resolveLivePersonaRoleKey";

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: "s1",
    title: "History Taking",
    description: "",
    completed: false,
    role: "Client (Horse Owner)",
    ...overrides,
  };
}

describe("resolveLivePersonaRoleKey", () => {
  it("maps known stage_type via STAGE_TYPE_TO_PERSONA", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ settings: { stage_type: "physical" } })),
      "veterinary-nurse"
    );
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ settings: { stage_type: "history" } })),
      "owner"
    );
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ settings: { stage_type: "laboratory" } })),
      "lab-technician"
    );
  });

  it("prefers the DB personaRoleKey when stage_type is missing", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ personaRoleKey: "owner" })),
      "owner"
    );
  });

  it("falls back to the title for History Taking (no stage_type, no personaRoleKey)", () => {
    assert.equal(
      resolveLivePersonaRoleKey(
        makeStage({ title: "History Taking", role: "Client (Horse Owner)" })
      ),
      "owner"
    );
  });

  it("falls back to the role text (Client → owner)", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Stage 1", role: "Client (Horse Owner)" })),
      "owner"
    );
  });

  it("infers nurse from Physical Examination / Treatment Plan", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Physical Examination", role: "Veterinary Nurse" })),
      "veterinary-nurse"
    );
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Treatment Plan", role: "Veterinary Nurse" })),
      "veterinary-nurse"
    );
  });

  it("infers lab from Laboratory & Tests", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Laboratory & Tests", role: "Laboratory Technician" })),
      "lab-technician"
    );
  });

  it("infers owner from Diagnostic Planning and Client Communication", () => {
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Diagnostic Planning", role: "Veterinary Nurse" })),
      "owner"
    );
    assert.equal(
      resolveLivePersonaRoleKey(makeStage({ title: "Client Communication", role: "Client" })),
      "owner"
    );
  });

  it("defaults to veterinary-nurse for unknown stages and empty input", () => {
    assert.equal(resolveLivePersonaRoleKey(makeStage({ title: "Custom Stage", role: "" })), "veterinary-nurse");
    assert.equal(resolveLivePersonaRoleKey(null), "veterinary-nurse");
    assert.equal(resolveLivePersonaRoleKey(undefined), "veterinary-nurse");
  });
});

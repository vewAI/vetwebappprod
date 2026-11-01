import { describe, it, expect } from "vitest";
import {
  validatePersonaVoices,
  normalizeVoiceId,
  getVoiceLabel,
  findDistinctAlternativeVoice,
} from "@/features/personas/utils/personaVoiceValidation";

describe("Persona Voice Validation & Conflict Prevention", () => {
  it("normalizes voice IDs correctly (trims whitespace and lowercases)", () => {
    expect(normalizeVoiceId(" Nova ")).toBe("nova");
    expect(normalizeVoiceId("SHIMMER")).toBe("shimmer");
    expect(normalizeVoiceId("")).toBe("");
    expect(normalizeVoiceId(null)).toBe("");
    expect(normalizeVoiceId(undefined)).toBe("");
  });

  it("retrieves friendly voice labels from presets", () => {
    expect(getVoiceLabel("nova")).toBe("Nova (American Female)");
    expect(getVoiceLabel("shimmer")).toBe("Shimmer (American Female)");
    expect(getVoiceLabel("fable")).toBe("Fable (British Male)");
    expect(getVoiceLabel("unknown-voice")).toBe("unknown-voice");
  });

  it("passes validation when personas have distinct voices", () => {
    const result = validatePersonaVoices([
      { role: "Owner", displayName: "Sarah", voiceId: "shimmer" },
      { role: "Veterinary Nurse", displayName: "Emily", voiceId: "nova" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("fails validation and returns descriptive error when owner and nurse share the same voice", () => {
    const result = validatePersonaVoices([
      { role: "Animal Owner", displayName: "John", voiceId: "nova" },
      { role: "Veterinary Nurse", displayName: "Sarah Mitchell", voiceId: "nova" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].voiceId).toBe("nova");
    expect(result.error).toContain('cannot share the same voice ("Nova (American Female)")');
    expect(result.error).toContain("Animal Owner (John)");
    expect(result.error).toContain("Veterinary Nurse (Sarah Mitchell)");
  });

  it("detects case-insensitive and whitespace-padded duplicates", () => {
    const result = validatePersonaVoices([
      { role: "Owner", voiceId: " Shimmer " },
      { role: "Nurse", voiceId: "shimmer" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.conflicts[0].voiceId).toBe("shimmer");
  });

  it("ignores unassigned or blank voices without generating false conflicts", () => {
    const result = validatePersonaVoices([
      { role: "Owner", voiceId: "" },
      { role: "Nurse", voiceId: null },
      { role: "Vet", voiceId: "fable" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("detects conflicts across three or more personas", () => {
    const result = validatePersonaVoices([
      { role: "Owner", voiceId: "george" },
      { role: "Nurse", voiceId: "nova" },
      { role: "Lab Technician", voiceId: "george" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.conflicts[0].voiceId).toBe("george");
    expect(result.conflicts[0].personas).toContain("Owner");
    expect(result.conflicts[0].personas).toContain("Lab Technician");
  });

  it("finds a distinct alternative voice avoiding taken voices", () => {
    const altFemale = findDistinctAlternativeVoice(["shimmer", "nova"], "female");
    expect(altFemale).not.toBe("shimmer");
    expect(altFemale).not.toBe("nova");
    expect(["alice", "charlotte", "lily", "matilda", "alloy"]).toContain(altFemale);

    const altMale = findDistinctAlternativeVoice(["fable", "onyx"], "male");
    expect(altMale).not.toBe("fable");
    expect(altMale).not.toBe("onyx");
    expect(["echo", "charlie", "george", "harry"]).toContain(altMale);
  });
});

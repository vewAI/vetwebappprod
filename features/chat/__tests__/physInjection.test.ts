import { parseRequestedKeys, matchPhysicalFindings } from "@/features/chat/services/physFinder";
import { describe, it, expect } from "vitest";

describe("Physical findings injection snippet", () => {
  it("should extract Heart rate when requested and documented", () => {
    const userText = "What is the heart rate?";
    const requested = parseRequestedKeys(userText);
    expect(requested.canonical).toContain("heart_rate");

    const physText = `Heart rate: 88 bpm\nRespiratory rate: 20 breaths/min\nTemperature: 38.5 C`;
    const subsetKeys = requested.canonical;
    const subset = matchPhysicalFindings({ ...requested, canonical: subsetKeys }, physText);
    expect(subset.length).toBeGreaterThan(0);
    const hr = subset.find((s) => s.canonicalKey === "heart_rate");
    expect(hr).toBeDefined();
    expect(hr!.lines.length).toBeGreaterThan(0);
    // Emulate cleaning and snippet building from server
    const cleanValue = (v: string): string => {
      if (!v) return v;
      let s = v.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
      s = s.replace(/,$/, "").trim();
      if (s.includes(":")) {
        const parts = s.split(":");
        parts.shift();
        s = parts.join(":").trim();
      }
      return s;
    };
    const vals = hr!.lines.map((l) => cleanValue(l)).filter(Boolean);
    expect(vals.join(", ")).toContain("88");
  });

  it("should build a PHYSICAL_EXAM_FINDINGS snippet when nurse requests heart rate (on_demand)", () => {
    // Simulate route logic: on_demand strategy and personaIsNurseOrLab true
    const userText = "What is the heart rate?";
    const lastUserContent = userText;
    const requested = parseRequestedKeys(lastUserContent);
    const allowedPhysKeys = new Set(["heart_rate","respiratory_rate","temperature","blood_pressure"]);
    const requestedPhys = (requested?.canonical ?? []).filter((k: string) => allowedPhysKeys.has(k));
    expect(requestedPhys).toContain("heart_rate");

    const physText = `Heart rate: 88 bpm\nRespiratory rate: 20 breaths/min`;
    const subsetKeys = requestedPhys.length > 0 ? requestedPhys : ["heart_rate"];
    const subset = matchPhysicalFindings({ ...requested, canonical: subsetKeys }, physText);
    const displayNames: Record<string, string> = {
      heart_rate: "Heart rate",
      respiratory_rate: "Respiratory rate",
      temperature: "Temperature",
      blood_pressure: "Blood pressure",
    };
    const cleanValue = (v: string): string => {
      if (!v) return v;
      let s = v.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
      s = s.replace(/,$/, "").trim();
      if (s.includes(":")) {
        const parts = s.split(":");
        parts.shift();
        s = parts.join(":").trim();
      }
      return s;
    };
    const uniq = (arr: string[]) => Array.from(new Set(arr));
    const phrases: string[] = [];
    for (const m of subset) {
      const name = displayNames[m.canonicalKey] ?? m.canonicalKey;
      if (m.lines && m.lines.length > 0) {
        const vals = uniq(m.lines.map((l) => cleanValue(l))).filter(Boolean);
        const combined = vals.length > 0 ? vals.join(" | ") : null;
        if (combined) {
          phrases.push(`${name}: ${combined}`);
        } else {
          phrases.push(`${name}: not documented`);
        }
      } else {
        phrases.push(`${name}: not documented`);
      }
    }
    const snippet = phrases.join(", ");
    expect(snippet).toContain("Heart rate: 88");
  });
});
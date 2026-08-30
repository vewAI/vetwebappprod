import { describe, it, expect } from "vitest";
import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys groups", () => {
  it("expands vitals to multiple canonical keys", () => {
    const r = parseRequestedKeys("vitals");
    expect([...r.canonical].sort()).toEqual(["blood_pressure", "heart_rate", "respiratory_rate", "temperature"]);
  });

  it("handles 'vital' singular", () => {
    const r = parseRequestedKeys("vital");
    expect([...r.canonical].sort()).toEqual(["blood_pressure", "heart_rate", "respiratory_rate", "temperature"]);
  });
});

import { describe, it, expect } from "vitest";
import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys", () => {
  it("parses comma-separated tokens", () => {
    const r = parseRequestedKeys("hr, rr, temp");
    expect(r.canonical).toEqual(["heart_rate", "respiratory_rate", "temperature"]);
  });

  it("parses 'and' separated tokens and aliases", () => {
    const r = parseRequestedKeys("pulse and temp");
    expect(r.canonical).toEqual(["heart_rate", "temperature"]);
  });

  it("parses space separated tokens", () => {
    const r = parseRequestedKeys("hr rr temp");
    expect(r.canonical).toEqual(["heart_rate", "respiratory_rate", "temperature"]);
  });

  it("parses procedure tokens like rectal palpation, nasogastric tube, and abdominocentesis", () => {
    const r = parseRequestedKeys("rectal palpation and nasogastric tube, abdominocentesis");
    // order is not important but keys should be present
    expect(r.canonical).toEqual(expect.arrayContaining(["rectal_palpation", "nasogastric_intubation", "abdominocentesis"]));
  });

  it("does not match temperature for common words with 't' (e.g. 'about', 'rate')", () => {
    const r = parseRequestedKeys("So about respiratory and heart rate.");
    expect(r.canonical).toEqual(["respiratory_rate", "heart_rate"]);
  });
});

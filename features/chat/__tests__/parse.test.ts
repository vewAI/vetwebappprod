import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys", () => {
  test("parses comma-separated tokens", () => {
    const r = parseRequestedKeys("hr, rr, temp");
    expect(r.canonical).toEqual(["heart_rate", "respiratory_rate", "temperature"]);
  });

  test("parses 'and' separated tokens and aliases", () => {
    const r = parseRequestedKeys("pulse and temp");
    expect(r.canonical).toEqual(["heart_rate", "temperature"]);
  });

  test("parses space separated tokens", () => {
    const r = parseRequestedKeys("hr rr temp");
    expect(r.canonical).toEqual(["heart_rate", "respiratory_rate", "temperature"]);
  });

  test("parses procedure tokens like rectal palpation, nasogastric tube, and abdominocentesis", () => {
    const r = parseRequestedKeys("rectal palpation and nasogastric tube, abdominocentesis");
    // order is not important but keys should be present
    expect(r.canonical).toEqual(expect.arrayContaining(["rectal_palpation", "nasogastric_intubation", "abdominocentesis"]));
  });
});

import { parseRequestedKeys, matchPhysicalFindings } from "../services/physFinder";

const SAMPLE = `Heart rate: 88 bpm\nRespiratory rate: 20/min\nTemperature: 38 C\nMucous membranes: pink`;

describe("matchPhysicalFindings", () => {
  test("matches heart rate and respiratory rate", () => {
    const req = parseRequestedKeys("hr, rr");
    const res = matchPhysicalFindings(req, SAMPLE);
    const keys = res.map((r) => r.canonicalKey);
    expect(keys).toEqual(["heart_rate", "respiratory_rate"]);
    expect(res[0].lines.length).toBeGreaterThan(0);
    expect(res[1].lines.length).toBeGreaterThan(0);
  });
});

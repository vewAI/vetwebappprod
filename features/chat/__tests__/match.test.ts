import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRequestedKeys, matchPhysicalFindings } from "../services/physFinder";

const SAMPLE = `Heart rate: 88 bpm\nRespiratory rate: 20/min\nTemperature: 38 C\nMucous membranes: pink`;

describe("matchPhysicalFindings", () => {
  it("matches heart rate and respiratory rate", () => {
    const req = parseRequestedKeys("hr, rr");
    const res = matchPhysicalFindings(req, SAMPLE);
    const keys = res.map((r) => r.canonicalKey);
    assert.deepEqual(keys, ["heart_rate", "respiratory_rate"]);
    assert.ok(res[0].lines.length > 0);
    assert.ok(res[1].lines.length > 0);
  });
});

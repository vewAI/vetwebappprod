import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys groups", () => {
  it("expands vitals to multiple canonical keys", () => {
    const r = parseRequestedKeys("vitals");
    assert.deepEqual(r.canonical.sort(), ["blood_pressure","heart_rate","respiratory_rate","temperature"].sort());
  });

  it("handles 'vital' singular", () => {
    const r = parseRequestedKeys("vital");
    assert.deepEqual(r.canonical.sort(), ["blood_pressure","heart_rate","respiratory_rate","temperature"].sort());
  });
});

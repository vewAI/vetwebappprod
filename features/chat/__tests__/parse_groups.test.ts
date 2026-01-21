import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys groups", () => {
  test("expands vitals to multiple canonical keys", () => {
    const r = parseRequestedKeys("vitals");
    expect(r.canonical.sort()).toEqual(["blood_pressure","heart_rate","respiratory_rate","temperature"].sort());
  });

  test("handles 'vital' singular", () => {
    const r = parseRequestedKeys("vital");
    expect(r.canonical.sort()).toEqual(["blood_pressure","heart_rate","respiratory_rate","temperature"].sort());
  });
});

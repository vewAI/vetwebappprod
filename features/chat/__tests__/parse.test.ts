import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRequestedKeys } from "../services/physFinder";

describe("parseRequestedKeys", () => {
  it("parses comma-separated tokens", () => {
    const r = parseRequestedKeys("hr, rr, temp");
    assert.deepEqual(r.canonical, ["heart_rate", "respiratory_rate", "temperature"]);
  });

  it("parses 'and' separated tokens and aliases", () => {
    const r = parseRequestedKeys("pulse and temp");
    assert.deepEqual(r.canonical, ["heart_rate", "temperature"]);
  });

  it("parses space separated tokens", () => {
    const r = parseRequestedKeys("hr rr temp");
    assert.deepEqual(r.canonical, ["heart_rate", "respiratory_rate", "temperature"]);
  });
});

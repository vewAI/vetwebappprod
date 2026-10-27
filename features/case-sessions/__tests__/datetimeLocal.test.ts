import assert from "assert";
import { describe, it } from "vitest";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "../utils/datetimeLocal";
import { deriveStatus } from "../models/caseSession";

describe("fromDatetimeLocalValue", () => {
  it("treats the value as local wall time, not UTC", () => {
    const iso = fromDatetimeLocalValue("2026-10-27T13:19");
    const parsed = new Date(iso);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 9);
    assert.equal(parsed.getDate(), 27);
    assert.equal(parsed.getHours(), 13);
    assert.equal(parsed.getMinutes(), 19);
    assert.equal(parsed.getSeconds(), 0);
  });

  it("returns empty string for invalid input", () => {
    assert.equal(fromDatetimeLocalValue("not-a-date"), "");
    assert.equal(fromDatetimeLocalValue(""), "");
  });
});

describe("toDatetimeLocalValue", () => {
  it("round-trips local hours and minutes", () => {
    const d = new Date(2026, 9, 27, 13, 19, 45);
    assert.equal(toDatetimeLocalValue(d), "2026-10-27T13:19");
  });
});

describe("deriveStatus", () => {
  it("is active when start is now", () => {
    const now = new Date("2026-10-27T17:19:00.000Z");
    assert.equal(
      deriveStatus({ startAt: now.toISOString(), endAt: "2026-10-27T19:19:00.000Z" }, now),
      "active"
    );
  });

  it("is active when start is a few seconds in the past (datetime-local minute precision)", () => {
    const now = new Date("2026-10-27T17:19:45.000Z");
    assert.equal(
      deriveStatus(
        { startAt: "2026-10-27T17:19:00.000Z", endAt: "2026-10-27T19:19:00.000Z" },
        now
      ),
      "active"
    );
  });

  it("is scheduled when start is still in the future", () => {
    const now = new Date("2026-10-27T17:19:00.000Z");
    assert.equal(
      deriveStatus(
        { startAt: "2026-10-27T18:19:00.000Z", endAt: "2026-10-27T19:19:00.000Z" },
        now
      ),
      "scheduled"
    );
  });
});

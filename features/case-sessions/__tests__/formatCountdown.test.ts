import assert from "assert";
import { describe, it } from "vitest";
import { formatCountdown } from "../hooks/useCountdown";

describe("formatCountdown", () => {
  it("returns zero when the window has closed", () => {
    assert.equal(formatCountdown(0), "0:00:00");
    assert.equal(formatCountdown(-1000), "0:00:00");
  });

  it("formats hours minutes and seconds", () => {
    assert.equal(formatCountdown(5 * 60 * 60 * 1000 + 7 * 60 * 1000 + 9 * 1000), "05:07:09");
  });

  it("includes days when more than 24 hours remain", () => {
    assert.equal(formatCountdown(2 * 24 * 60 * 60 * 1000 + 1000), "2d 00:00:01");
  });
});

import assert from "assert";
import { describe, it } from "vitest";
import { buildCaseTimeSpentStats, formatCompactDuration } from "../lib/caseTimeSpentStats";

describe("formatCompactDuration", () => {
  it("formats seconds minutes and hours", () => {
    assert.equal(formatCompactDuration(45), "45s");
    assert.equal(formatCompactDuration(180), "3m");
    assert.equal(formatCompactDuration(3600), "1h");
    assert.equal(formatCompactDuration(5400), "1h 30m");
  });
});

describe("buildCaseTimeSpentStats", () => {
  const academicYearEnd = { month: 7, day: 31 };
  const now = new Date("2026-10-28T12:00:00Z");

  it("defaults to the current academic year and averages over the elapsed period", () => {
    const stats = buildCaseTimeSpentStats({
      attempts: [
        { createdAt: "2026-09-01T10:00:00Z", timeSpentSeconds: 3600 },
        { createdAt: "2025-09-01T10:00:00Z", timeSpentSeconds: 7200 },
      ],
      period: "current",
      academicYearEnd,
      now,
    });

    assert.equal(stats.periodLabel, "This academic year");
    assert.equal(stats.totalSeconds, 3600);
    assert.equal(stats.points.reduce((sum, point) => sum + point.attempts, 0), 1);
    assert.ok(stats.avgWeeklySeconds > stats.avgDailySeconds);
    assert.ok(stats.avgMonthlySeconds > stats.avgWeeklySeconds);
  });

  it("includes every attempt for all time", () => {
    const stats = buildCaseTimeSpentStats({
      attempts: [
        { createdAt: "2026-09-01T10:00:00Z", timeSpentSeconds: 3600 },
        { createdAt: "2025-09-01T10:00:00Z", timeSpentSeconds: 7200 },
      ],
      period: "anytime",
      academicYearEnd,
      now,
    });

    assert.equal(stats.periodLabel, "All time");
    assert.equal(stats.totalSeconds, 10800);
    assert.equal(stats.points.reduce((sum, point) => sum + point.attempts, 0), 2);
  });
});

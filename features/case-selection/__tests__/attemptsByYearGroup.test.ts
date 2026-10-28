import assert from "assert";
import { describe, it } from "vitest";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { attemptsBySessionYearGroup } from "../lib/attemptsByYearGroup";

function attempt(overrides: Partial<AttemptSummary>): AttemptSummary {
  return {
    id: "a1",
    userId: "u1",
    caseId: "c1",
    title: "Attempt",
    createdAt: "2026-09-01T10:00:00Z",
    completionStatus: "completed",
    lastStageIndex: 0,
    timeSpentSeconds: 60,
    caseTitle: "Case",
    caseCategory: "Surgery",
    caseDifficulty: "Easy",
    caseImageUrl: null,
    ...overrides,
  };
}

describe("attemptsBySessionYearGroup", () => {
  const academicYearEnd = { month: 7, day: 31 };
  const now = new Date("2026-10-28T12:00:00Z");
  const sessionsById = new Map([
    ["s1", { yearGroupId: "yg1", yearGroupName: "Year 1" }],
    ["s2", { yearGroupId: "yg2", yearGroupName: "Year 2" }],
  ]);

  it("groups by the session year group rather than a student year group", () => {
    const rows = attemptsBySessionYearGroup({
      attempts: [
        attempt({ id: "1", sessionId: "s1", sessionYearGroupId: "yg1", sessionYearGroupName: "Year 1" }),
        attempt({ id: "2", sessionId: "s1", sessionYearGroupId: "yg1", sessionYearGroupName: "Year 1" }),
        attempt({ id: "3", sessionId: "s2", sessionYearGroupId: "yg2", sessionYearGroupName: "Year 2" }),
      ],
      sessionsById,
      period: "anytime",
      academicYearEnd,
      now,
    });

    assert.deepEqual(
      rows.map((row) => ({ id: row.id, count: row.count })),
      [
        { id: "yg1", count: 2 },
        { id: "yg2", count: 1 },
      ],
    );
  });

  it("uses the session lookup when the attempt has no year group fields", () => {
    const rows = attemptsBySessionYearGroup({
      attempts: [attempt({ id: "1", sessionId: "s2" })],
      sessionsById,
      period: "anytime",
      academicYearEnd,
      now,
    });
    assert.equal(rows[0]?.id, "yg2");
    assert.equal(rows[0]?.name, "Year 2");
  });

  it("limits current period to this academic year", () => {
    const rows = attemptsBySessionYearGroup({
      attempts: [
        attempt({ id: "1", sessionId: "s1", createdAt: "2026-09-01T10:00:00Z", sessionYearGroupId: "yg1" }),
        attempt({ id: "2", sessionId: "s2", createdAt: "2025-09-01T10:00:00Z", sessionYearGroupId: "yg2" }),
      ],
      sessionsById,
      period: "current",
      academicYearEnd,
      now,
    });
    assert.deepEqual(rows.map((row) => row.id), ["yg1"]);
  });
});

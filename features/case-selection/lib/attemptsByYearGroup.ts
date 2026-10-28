import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { isAfterAcademicYearCutoff } from "@/features/year-groups/models/yearGroup";
import type { TimePeriod } from "./caseTimeSpentStats";

export type YearGroupAttemptCount = {
  id: string;
  name: string;
  count: number;
};

export function attemptsBySessionYearGroup({
  attempts,
  sessionsById,
  period,
  academicYearEnd,
  now = new Date(),
}: {
  attempts: AttemptSummary[];
  sessionsById: Map<string, { yearGroupId: string | null; yearGroupName?: string | null }>;
  period: TimePeriod;
  academicYearEnd: { month: number; day: number };
  now?: Date;
}): YearGroupAttemptCount[] {
  const filtered =
    period === "current"
      ? attempts.filter((attempt) =>
          isAfterAcademicYearCutoff(attempt.createdAt, academicYearEnd.month, academicYearEnd.day, now),
        )
      : attempts;

  const counts = new Map<string, YearGroupAttemptCount>();
  for (const attempt of filtered) {
    const session = attempt.sessionId ? sessionsById.get(attempt.sessionId) : undefined;
    const id = attempt.sessionYearGroupId ?? session?.yearGroupId ?? "none";
    const name =
      attempt.sessionYearGroupName ?? session?.yearGroupName ?? (id === "none" ? "Unassigned" : "Year group");
    const current = counts.get(id);
    if (current) {
      current.count += 1;
    } else {
      counts.set(id, { id, name, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

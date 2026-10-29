import { isAfterAcademicYearCutoff, latestAcademicYearCutoffDate } from "@/features/year-groups/models/yearGroup";

export type TimePeriod = "current" | "anytime";

export type CaseTimeSpentPoint = {
  date: string;
  attempts: number;
};

export type CaseTimeSpentStats = {
  totalSeconds: number;
  avgDailySeconds: number;
  avgWeeklySeconds: number;
  avgMonthlySeconds: number;
  points: CaseTimeSpentPoint[];
  periodLabel: string;
  granularity: "week" | "month";
};

const MS_DAY = 24 * 60 * 60 * 1000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function addUtcDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function utcYmd(value: Date | string) {
  if (typeof value === "string") {
    const day = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function daysInclusive(startYmd: string, endYmd: string) {
  const start = new Date(`${startYmd}T00:00:00Z`).getTime();
  const end = new Date(`${endYmd}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.max(1, Math.floor((end - start) / MS_DAY) + 1);
}

function academicYearStartYmd(month: number, day: number, now: Date) {
  return addUtcDays(latestAcademicYearCutoffDate(month, day, now), 1);
}

function enumerateWeeks(startYmd: string, endYmd: string) {
  const weeks: string[] = [];
  let cursor = startYmd;
  while (cursor <= endYmd) {
    weeks.push(cursor);
    cursor = addUtcDays(cursor, 7);
  }
  return weeks.length > 0 ? weeks : [startYmd];
}

function enumerateMonths(startYmd: string, endYmd: string) {
  const [startYear, startMonth] = startYmd.split("-").map(Number);
  const [endYear, endMonth] = endYmd.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${pad2(month)}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months.length > 0 ? months : [`${startYear}-${pad2(startMonth)}-01`];
}

function assignToBucket(day: string, buckets: string[]) {
  let index = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] <= day) index = i;
    else break;
  }
  return index;
}

export function formatCompactDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours >= 1000) {
    const thousands = hours / 1000;
    return `${thousands >= 10 ? thousands.toFixed(0) : thousands.toFixed(1).replace(/\.0$/, "")}Kh`;
  }
  return remain === 0 ? `${hours}h` : `${hours}h ${remain}m`;
}

export function buildCaseTimeSpentStats({
  attempts,
  period,
  academicYearEnd,
  now = new Date(),
}: {
  attempts: Array<{ createdAt: string; timeSpentSeconds: number }>;
  period: TimePeriod;
  academicYearEnd: { month: number; day: number };
  now?: Date;
}): CaseTimeSpentStats {
  const today = utcYmd(now);
  const filtered =
    period === "current"
      ? attempts.filter((attempt) =>
          isAfterAcademicYearCutoff(attempt.createdAt, academicYearEnd.month, academicYearEnd.day, now),
        )
      : attempts;

  const attemptDays = filtered
    .map((attempt) => utcYmd(attempt.createdAt))
    .filter((day) => day.length > 0)
    .sort();

  const startYmd =
    period === "current"
      ? academicYearStartYmd(academicYearEnd.month, academicYearEnd.day, now)
      : (attemptDays[0] ?? addUtcDays(today, -83));
  const endYmd = today < startYmd ? startYmd : today;
  const dayCount = daysInclusive(startYmd, endYmd);
  const totalSeconds = filtered.reduce((sum, attempt) => sum + Math.max(0, attempt.timeSpentSeconds || 0), 0);

  const granularity = dayCount > 140 ? "month" : "week";
  const buckets = granularity === "month" ? enumerateMonths(startYmd, endYmd) : enumerateWeeks(startYmd, endYmd);
  const points = buckets.map((date) => ({ date, attempts: 0 }));
  for (const attempt of filtered) {
    const day = utcYmd(attempt.createdAt);
    if (!day) continue;
    const index = assignToBucket(day, buckets);
    points[index].attempts += 1;
  }

  return {
    totalSeconds,
    avgDailySeconds: totalSeconds / dayCount,
    avgWeeklySeconds: totalSeconds / Math.max(1, dayCount / 7),
    avgMonthlySeconds: totalSeconds / Math.max(1, dayCount / 30.4375),
    points,
    periodLabel: period === "current" ? "This academic year" : "All time",
    granularity,
  };
}

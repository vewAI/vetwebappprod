export interface YearGroup {
  id: string;
  institutionId: string;
  institutionName?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export function formatAcademicYearEnd(month: number, day: number) {
  const safeMonth = month >= 1 && month <= 12 ? month : 7;
  const safeDay = day >= 1 && day <= 31 ? day : 31;
  const date = new Date(Date.UTC(2000, safeMonth - 1, safeDay));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function formatAcademicYearDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Inclusive start and end dates of the current academic year, after the latest cutoff. */
export function currentAcademicYearRange(
  month = 7,
  day = 31,
  now = new Date(),
): { startLabel: string; endLabel: string } {
  const cutoff = latestAcademicYearCutoffDate(month, day, now);
  const [year, cutoffMonth, cutoffDay] = cutoff.split("-").map(Number);
  const start = new Date(Date.UTC(year, cutoffMonth - 1, cutoffDay + 1));
  return {
    startLabel: formatAcademicYearDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
    endLabel: formatAcademicYearDate(year + 1, cutoffMonth, cutoffDay),
  };
}

export function defaultAcademicYearEnd() {
  return { month: 7, day: 31 };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function londonYmd(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

/** Most recent academic-year cutoff date (YYYY-MM-DD, Europe/London) that is strictly before today. */
export function latestAcademicYearCutoffDate(
  month = 7,
  day = 31,
  now = new Date(),
): string {
  const safeMonth = month >= 1 && month <= 12 ? month : 7;
  const safeDay = day >= 1 && day <= 31 ? day : 31;
  const today = londonYmd(now);
  const passedThisYear = today.month > safeMonth || (today.month === safeMonth && today.day > safeDay);
  const year = passedThisYear ? today.year : today.year - 1;
  return `${year}-${pad2(safeMonth)}-${pad2(safeDay)}`;
}

/** True when `createdAt` is after the institution's latest academic-year cutoff. */
export function isAfterAcademicYearCutoff(
  createdAt: string,
  month = 7,
  day = 31,
  now = new Date(),
): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const createdDay = londonYmd(created);
  const createdStr = `${createdDay.year}-${pad2(createdDay.month)}-${pad2(createdDay.day)}`;
  return createdStr > latestAcademicYearCutoffDate(month, day, now);
}

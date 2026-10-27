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

export function defaultAcademicYearEnd() {
  return { month: 7, day: 31 };
}

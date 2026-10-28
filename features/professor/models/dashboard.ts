export interface AttemptDayCount {
  date: string;
  attempts: number;
}

export interface RankedCount {
  id: string;
  name: string;
  count: number;
  href?: string;
}

export interface ProfessorDashboardStats {
  studentCount: number;
  caseCount: number;
  activeSessionCount: number;
  attemptsByDay: AttemptDayCount[];
  topCases: RankedCount[];
  topSessions: RankedCount[];
  studentsByYearGroup: RankedCount[];
}

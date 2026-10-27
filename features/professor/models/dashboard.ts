export interface AttemptDayCount {
  date: string;
  attempts: number;
}

export interface ProfessorDashboardStats {
  studentCount: number;
  caseCount: number;
  activeSessionCount: number;
  attemptsByDay: AttemptDayCount[];
}

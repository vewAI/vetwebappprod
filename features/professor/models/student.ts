export interface ProfessorStudentRow {
  userId: string;
  email: string;
  yearGroupId: string | null;
  yearGroupName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface ProfessorStudentDetail extends ProfessorStudentRow {
  attempts: import("@/features/attempts/models/attempt").AttemptSummary[];
}

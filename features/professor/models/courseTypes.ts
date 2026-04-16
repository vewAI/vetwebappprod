export interface Course {
  id: string;
  professorId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  studentCount?: number;
  archived?: boolean;
}

export interface CourseStudent {
  id: string;
  courseId: string;
  studentId: string;
  addedAt: string;
  student?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface CourseCaseAssignment {
  id: string;
  courseId: string;
  caseId: string;
  assignedBy: string;
  assignedAt: string;
  case?: {
    id: string;
    title: string;
    difficulty: string;
    species: string;
  };
}

export interface CourseStats {
  totalStudents: number;
  studentsWithCompletedAttempt: number;
  totalAttempts: number;
  completedAttempts: number;
  completionRate: number;
  avgTimeSeconds: number;
  perStudent: StudentStat[];
  perCase: CaseStat[];
}

export interface StudentStat {
  studentId: string;
  fullName: string;
  email: string;
  completedAttempts: number;
  totalAttempts: number;
  avgTimeSeconds: number;
  lastActivityAt: string | null;
}

export interface CaseStat {
  caseId: string;
  caseTitle: string;
  studentsCompleted: number;
  studentsAssigned: number;
}

export interface PendingReview {
  attemptId: string;
  studentId: string;
  studentName: string;
  caseId: string;
  caseTitle: string;
  completedAt: string;
}

export interface CompletionTrend {
  period: string;
  completions: number;
  totalAttempts: number;
}

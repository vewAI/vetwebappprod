export type SessionStatus = "scheduled" | "active" | "completed";

export interface CaseSession {
  id: string;
  caseId: string;
  createdBy: string;
  name: string;
  friendlyName: string;
  description: string;
  accessCode: string | null;
  startAt: string;
  endAt: string;
  attemptLimitPerStudent: number | null;
  createdAt: string;
  updatedAt: string;
  case?: {
    id: string;
    title: string;
    species: string;
    difficulty: string;
    imageUrl: string;
  };
}

export interface SessionAttemptRow {
  id: string;
  userId: string;
  caseId: string;
  sessionId: string | null;
  completionStatus: "in_progress" | "completed" | "abandoned";
  createdAt: string;
  completedAt?: string;
  timeSpentSeconds: number;
  studentName?: string;
  studentEmail?: string;
}

export function deriveStatus(
  s: Pick<CaseSession, "startAt" | "endAt">,
  now: Date = new Date()
): SessionStatus {
  const start = new Date(s.startAt).getTime();
  const end = new Date(s.endAt).getTime();
  const t = now.getTime();
  if (t < start) return "scheduled";
  if (t < end) return "active";
  return "completed";
}

"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import { attemptViewHref, type AttemptViewFrom } from "@/features/attempts/attemptViewHref";
import { professorSessionHref } from "@/features/case-sessions/sessionViewHref";
import type { AttemptSummary } from "@/features/attempts/models/attempt";

type AttemptSortKey = "student" | "case" | "session" | "year" | "status" | "date" | "time";

const statusRank: Record<AttemptSummary["completionStatus"], number> = {
  in_progress: 1,
  completed: 2,
  abandoned: 3,
};

function formatAttemptDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeSpent(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

function statusLabel(status: AttemptSummary["completionStatus"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Abandoned";
}

type Props = {
  attempts: AttemptSummary[];
  loading?: boolean;
  emptyMessage: string;
  showStudent?: boolean;
  studentLabel?: string;
  showCase?: boolean;
  showSession?: boolean;
  showYearGroup?: boolean;
  /** `/professor/sessions` or `/start` */
  sessionHrefBase?: "/professor/sessions" | "/start";
  from?: AttemptViewFrom;
};

export function CaseAttemptsTable({
  attempts,
  loading = false,
  emptyMessage,
  showStudent = false,
  studentLabel = "Email",
  showCase = false,
  showSession = true,
  showYearGroup = true,
  sessionHrefBase,
  from,
}: Props) {
  const { sort, toggle, sorted } = useTableSort<AttemptSummary, AttemptSortKey>(
    attempts,
    (attempt, key) => {
      if (key === "student") return attempt.studentEmail ?? attempt.studentName ?? "";
      if (key === "case") return attempt.caseTitle || attempt.title;
      if (key === "session") return attempt.sessionName ?? "";
      if (key === "year") return attempt.sessionYearGroupName ?? "";
      if (key === "status") return statusRank[attempt.completionStatus] ?? 0;
      if (key === "date") return new Date(attempt.createdAt).getTime();
      return attempt.timeSpentSeconds;
    },
    { key: "date", dir: "desc" },
  );

  const colSpan = (showStudent ? 1 : 0) + (showCase ? 1 : 0) + (showSession ? 1 : 0) + (showYearGroup ? 1 : 0) + 4;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[720px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                {showStudent && <SortHeader label={studentLabel} column="student" sort={sort} onSort={toggle} />}
                {showCase && <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />}
                {showSession && <SortHeader label="Session" column="session" sort={sort} onSort={toggle} />}
                {showYearGroup && <SortHeader label="Year" column="year" sort={sort} onSort={toggle} />}
                <SortHeader label="Status" column="status" sort={sort} onSort={toggle} />
                <SortHeader label="Date" column="date" sort={sort} onSort={toggle} />
                <SortHeader label="Time" column="time" sort={sort} onSort={toggle} />
                <TableCell isHeader className="px-4 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  View
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    Loading attempts...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((attempt) => {
                  const href = attemptViewHref(attempt.id, from);
                  const sessionHref =
                    showSession && attempt.sessionId && sessionHrefBase
                      ? sessionHrefBase === "/professor/sessions"
                        ? professorSessionHref(attempt.sessionId, from === "case" ? "case" : undefined)
                        : `${sessionHrefBase}/${attempt.sessionId}`
                      : null;
                  const email = attempt.studentEmail?.trim() || "";
                  const studentHref = showStudent && attempt.userId ? `/professor/students/${attempt.userId}` : null;
                  return (
                    <TableRow key={attempt.id} className="hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                      {showStudent && (
                        <TableCell className="px-5 py-4 text-start text-theme-sm sm:px-6">
                          {studentHref ? (
                            <Link href={studentHref} className="font-medium text-primary hover:underline">
                              {email || "Student"}
                            </Link>
                          ) : (
                            <span className="text-gray-800 dark:text-white/90">{email || "—"}</span>
                          )}
                        </TableCell>
                      )}
                      {showCase && (
                        <TableCell className="px-5 py-4 text-start text-theme-sm font-medium text-gray-800 sm:px-6 dark:text-white/90">
                          {attempt.caseTitle || attempt.title || "—"}
                        </TableCell>
                      )}
                      {showSession && (
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {sessionHref ? (
                            <Link href={sessionHref} className="font-medium text-primary hover:underline">
                              {attempt.sessionName || "Session"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
                      {showYearGroup && (
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {attempt.sessionYearGroupName || "—"}
                        </TableCell>
                      )}
                      <TableCell className="px-5 py-4 text-start sm:px-6">
                        <Badge
                          variant={
                            attempt.completionStatus === "completed"
                              ? "success"
                              : attempt.completionStatus === "in_progress"
                                ? "warning"
                                : "destructive"
                          }
                          className={attempt.completionStatus === "abandoned" ? "text-white" : undefined}
                        >
                          {statusLabel(attempt.completionStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatAttemptDate(attempt.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatTimeSpent(attempt.timeSpentSeconds)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-end">
                        <Link href={href} className="font-medium text-primary hover:underline">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

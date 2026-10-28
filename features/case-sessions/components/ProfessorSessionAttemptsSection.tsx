"use client";

import { useMemo, useState } from "react";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { Select } from "@/features/navigation/components/select";
import type { CaseSession, SessionAttemptRow } from "../models/caseSession";

type Props = {
  session: CaseSession;
  attempts: SessionAttemptRow[];
};

function toAttemptSummary(row: SessionAttemptRow, session: CaseSession): AttemptSummary {
  return {
    id: row.id,
    userId: row.userId,
    caseId: row.caseId,
    sessionId: row.sessionId,
    sessionName: session.friendlyName,
    sessionYearGroupId: session.yearGroupId,
    sessionYearGroupName: session.yearGroupName ?? null,
    studentName: row.studentEmail ?? row.studentName ?? null,
    title: session.case?.title ?? session.friendlyName,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    completionStatus: row.completionStatus,
    lastStageIndex: 0,
    timeSpentSeconds: row.timeSpentSeconds,
    caseTitle: session.case?.title ?? "",
    caseCategory: session.case?.category ?? "",
    caseDifficulty: session.case?.difficulty ?? "",
    caseImageUrl: session.case?.imageUrl || null,
  };
}

export function ProfessorSessionAttemptsSection({ session, attempts }: Props) {
  const [emailSearch, setEmailSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const summaries = useMemo(
    () => attempts.map((row) => toAttemptSummary(row, session)),
    [attempts, session],
  );

  const filtered = useMemo(() => {
    const query = emailSearch.trim().toLowerCase();
    return summaries.filter((attempt) => {
      if (query && !(attempt.studentName ?? "").toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && attempt.completionStatus !== statusFilter) return false;
      return true;
    });
  }, [summaries, emailSearch, statusFilter]);

  const hasFilters = Boolean(emailSearch.trim()) || statusFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="search"
          value={emailSearch}
          onChange={(event) => setEmailSearch(event.target.value)}
          placeholder="Search by email"
          aria-label="Search by email"
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-800"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "completed", label: "Completed" },
            { value: "in_progress", label: "In Progress" },
            { value: "abandoned", label: "Abandoned" },
          ]}
        />
      </div>
      <p className="text-end text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "attempt" : "attempts"}
      </p>
      <CaseAttemptsTable
        attempts={filtered}
        showStudent
        showSession={false}
        studentLabel="Email"
        emptyMessage={hasFilters ? "No attempts match these filters." : "No attempts yet for this session."}
      />
    </div>
  );
}

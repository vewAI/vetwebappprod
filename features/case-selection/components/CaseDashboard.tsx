"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import { CaseDescriptionAndDetails, CaseHeroCard } from "@/features/case-selection/components/CaseDetails";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { SessionsForCaseList } from "@/features/case-sessions/components/SessionsForCaseList";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import { deriveStatus, type CaseSession } from "@/features/case-sessions/models/caseSession";
import { AttemptsByYearGroupChart } from "@/features/case-selection/components/AttemptsByYearGroupChart";
import { CaseTimeSpentChart } from "@/features/case-selection/components/CaseTimeSpentChart";
import { AttemptsPerDayChart } from "@/features/professor/components/charts/AttemptsPerDayChart";
import type { AttemptDayCount } from "@/features/professor/models/dashboard";
import { DefaultTabs } from "@/features/navigation/components/tabs";
import { FilterSearch } from "@/features/navigation/components/filter-search";
import { Select } from "@/features/navigation/components/select";
import { useAuth } from "@/features/auth/services/authService";
import { caseAttemptHref } from "@/features/case-selection/caseViewHref";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import {
  defaultAcademicYearEnd,
  isAfterAcademicYearCutoff,
} from "@/features/year-groups/models/yearGroup";
import type { Case } from "../models/case";

type TabId = "overview" | "sessions" | "attempts";

type RankedRow = {
  id: string;
  name: string;
  count: number;
};

const RANK_BUTTON_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white p-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]";

function lastThirtyDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function rankCounts(entries: Iterable<{ id: string; name: string }>, limit = 5): RankedRow[] {
  const map = new Map<string, RankedRow>();
  for (const entry of entries) {
    const current = map.get(entry.id);
    if (current) {
      current.count += 1;
    } else {
      map.set(entry.id, { id: entry.id, name: entry.name, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

function RankingCard({
  title,
  sourceLabel,
  valueLabel,
  rows,
  emptyMessage,
  actionLabel,
  onAction,
}: {
  title: string;
  sourceLabel: string;
  valueLabel: string;
  rows: RankedRow[];
  emptyMessage: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <div className="my-6 flex-1">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
          <span className="text-theme-xs text-gray-400">{sourceLabel}</span>
          <span className="text-end text-theme-xs text-gray-400">{valueLabel}</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-theme-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between border-b border-gray-100 py-3 dark:border-gray-800"
            >
              <span className="text-theme-sm text-gray-500 dark:text-gray-400">{row.name}</span>
              <span className="text-end text-theme-sm text-gray-500 dark:text-gray-400">{row.count}</span>
            </div>
          ))
        )}
      </div>
      <button type="button" className={`${RANK_BUTTON_CLASS} mt-auto`} onClick={onAction}>
        {actionLabel}
        <ChevronRight className="size-5 rtl:rotate-180" />
      </button>
    </div>
  );
}

export function CaseDashboard({
  caseId,
  caseData,
  attempts,
  attemptsLoading,
}: {
  caseId: string;
  caseData: Case;
  attempts: AttemptSummary[];
  attemptsLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const { institutionId, role } = useAuth();
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [academicYearFilter, setAcademicYearFilter] = useState<"current" | "anytime">("current");
  const [sessionYearFilter, setSessionYearFilter] = useState("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [sessionAcademicYearFilter, setSessionAcademicYearFilter] = useState<"current" | "anytime">("current");
  const [academicYearEnd, setAcademicYearEnd] = useState(defaultAcademicYearEnd);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      try {
        const list = await listSessions({ caseId, status: "all" });
        if (!cancelled) setSessions(list);
      } catch (error) {
        console.error(error);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const query = institutionId ? `?institutionId=${encodeURIComponent(institutionId)}` : "";
        const res = await fetch(`/api/year-groups${query}`, {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json().catch(() => ({}))) as {
          academicYearEnd?: { month: number; day: number } | null;
        };
        if (!cancelled && body.academicYearEnd) {
          setAcademicYearEnd({
            month: Number(body.academicYearEnd.month ?? 7),
            day: Number(body.academicYearEnd.day ?? 31),
          });
        }
      } catch {
        if (!cancelled) setAcademicYearEnd(defaultAcademicYearEnd());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  const sessionsById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);

  const chartData = useMemo<AttemptDayCount[]>(() => {
    const counts = new Map(lastThirtyDays().map((date) => [date, 0]));
    for (const attempt of attempts) {
      const day = attempt.createdAt.slice(0, 10);
      if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return lastThirtyDays().map((date) => ({ date, attempts: counts.get(date) ?? 0 }));
  }, [attempts]);

  const topSessions = useMemo(
    () =>
      rankCounts(
        attempts.flatMap((attempt) => {
          if (!attempt.sessionId) return [];
          const session = sessionsById.get(attempt.sessionId);
          return [
            {
              id: attempt.sessionId,
              name: attempt.sessionName || session?.friendlyName || "Session",
            },
          ];
        }),
      ),
    [attempts, sessionsById],
  );

  const sessionYearOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Year Groups" }];
    const seen = new Set<string>();
    for (const session of sessions) {
      if (!session.yearGroupId || seen.has(session.yearGroupId)) continue;
      seen.add(session.yearGroupId);
      options.push({ value: session.yearGroupId, label: session.yearGroupName ?? "Year group" });
    }
    if (sessions.some((session) => !session.yearGroupId)) {
      options.push({ value: "none", label: "Unassigned" });
    }
    return options;
  }, [sessions]);

  const attemptYearOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Year Groups" }];
    const seen = new Set<string>();
    for (const session of sessions) {
      if (!session.yearGroupId || seen.has(session.yearGroupId)) continue;
      seen.add(session.yearGroupId);
      options.push({ value: session.yearGroupId, label: session.yearGroupName ?? "Year group" });
    }
    if (attempts.some((attempt) => !attempt.sessionId || !sessionsById.get(attempt.sessionId)?.yearGroupId)) {
      options.push({ value: "none", label: "Unassigned" });
    }
    return options;
  }, [sessions, attempts, sessionsById]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (sessionYearFilter !== "all" && (session.yearGroupId ?? "none") !== sessionYearFilter) return false;
      if (sessionStatusFilter !== "all" && deriveStatus(session) !== sessionStatusFilter) return false;
      if (
        sessionAcademicYearFilter === "current" &&
        !isAfterAcademicYearCutoff(session.startAt, academicYearEnd.month, academicYearEnd.day)
      ) {
        return false;
      }
      return true;
    });
  }, [
    sessions,
    sessionYearFilter,
    sessionStatusFilter,
    sessionAcademicYearFilter,
    academicYearEnd.month,
    academicYearEnd.day,
  ]);

  const filteredAttempts = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return attempts.filter((attempt) => {
      if (
        query &&
        !(attempt.studentEmail ?? "").toLowerCase().includes(query) &&
        !(attempt.studentName ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }
      if (statusFilter !== "all" && attempt.completionStatus !== statusFilter) return false;
      if (yearFilter !== "all") {
        const session = attempt.sessionId ? sessionsById.get(attempt.sessionId) : undefined;
        const yearId = attempt.sessionYearGroupId ?? session?.yearGroupId ?? "none";
        if (yearId !== yearFilter) return false;
      }
      if (
        academicYearFilter === "current" &&
        !isAfterAcademicYearCutoff(attempt.createdAt, academicYearEnd.month, academicYearEnd.day)
      ) {
        return false;
      }
      return true;
    });
  }, [
    attempts,
    studentSearch,
    statusFilter,
    yearFilter,
    academicYearFilter,
    academicYearEnd.month,
    academicYearEnd.day,
    sessionsById,
  ]);

  const attemptsForTable = useMemo(
    () =>
      filteredAttempts.map((attempt) => {
        const session = attempt.sessionId ? sessionsById.get(attempt.sessionId) : undefined;
        return {
          ...attempt,
          sessionYearGroupId: attempt.sessionYearGroupId ?? session?.yearGroupId ?? null,
          sessionYearGroupName: attempt.sessionYearGroupName ?? session?.yearGroupName ?? null,
        };
      }),
    [filteredAttempts, sessionsById],
  );

  return (
    <div className="space-y-8">
      <CaseHeroCard caseData={caseData} />
      {role === "admin" && (
        <div className="flex justify-end">
          <Button asChild>
            <Link href={caseAttemptHref(caseId, { test: true })} target="_blank" rel="noopener noreferrer">
              Test case
            </Link>
          </Button>
        </div>
      )}

      <DefaultTabs<TabId>
        items={[
          { id: "overview", label: "Case Overview" },
          { id: "sessions", label: "Sessions", badge: sessions.length },
          { id: "attempts", label: "Attempts", badge: attempts.length },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === "overview" && (
          <div className="space-y-6">
            <CaseDescriptionAndDetails caseData={caseData} />

            <div className="rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-5 sm:px-6 sm:pt-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-4">
                <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Attempts</h3>
                <span className="block text-theme-sm text-gray-500 dark:text-gray-400">
                  Attempts made on this case in the last 30 days
                </span>
              </div>
              {attemptsLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading chart...</p>
              ) : (
                <AttemptsPerDayChart data={chartData} />
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <RankingCard
                title="Top Sessions"
                sourceLabel="Session"
                valueLabel="Attempts"
                rows={topSessions}
                emptyMessage="No session attempts yet."
                actionLabel="View Sessions"
                onAction={() => setActiveTab("sessions")}
              />
              <AttemptsByYearGroupChart
                attempts={attempts}
                sessions={sessions}
                loading={attemptsLoading}
                academicYearEnd={academicYearEnd}
              />
              <CaseTimeSpentChart
                attempts={attempts}
                loading={attemptsLoading}
                academicYearEnd={academicYearEnd}
              />
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3">
              <Select value={sessionYearFilter} onChange={setSessionYearFilter} options={sessionYearOptions} />
              <Select
                value={sessionAcademicYearFilter}
                onChange={(value) => setSessionAcademicYearFilter(value as "current" | "anytime")}
                options={[
                  { value: "current", label: "Current Academic Year" },
                  { value: "anytime", label: "Anytime" },
                ]}
              />
              <Select
                value={sessionStatusFilter}
                onChange={setSessionStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" asChild>
                <Link href={`/professor/sessions/new?caseId=${encodeURIComponent(caseId)}`}>Create session</Link>
              </Button>
              <p className="text-sm text-muted-foreground">
                {sessionsLoading
                  ? "Loading…"
                  : `${filteredSessions.length} ${filteredSessions.length === 1 ? "session" : "sessions"}`}
              </p>
            </div>
            <SessionsForCaseList
              caseId={caseId}
              variant="manage"
              sessions={filteredSessions}
              loading={sessionsLoading}
              emptyMessage={
                sessions.length === 0
                  ? "No sessions for this case yet. Create one to let students join during class."
                  : "No sessions match these filters."
              }
            />
          </div>
        )}

        {activeTab === "attempts" && (
          <div className="space-y-4">
            <div className="grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSearch value={studentSearch} onChange={setStudentSearch} placeholder="Search by email" />
              <Select
                value={yearFilter}
                onChange={setYearFilter}
                options={attemptYearOptions}
              />
              <Select
                value={academicYearFilter}
                onChange={(value) => setAcademicYearFilter(value as "current" | "anytime")}
                options={[
                  { value: "current", label: "Current Academic Year" },
                  { value: "anytime", label: "Anytime" },
                ]}
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
              {attemptsLoading ? "Loading…" : `${filteredAttempts.length} ${filteredAttempts.length === 1 ? "attempt" : "attempts"}`}
            </p>
            <CaseAttemptsTable
              attempts={attemptsForTable}
              loading={attemptsLoading}
              emptyMessage={
                attempts.length === 0 ? "No attempts on this case yet." : "No attempts match these filters."
              }
              showStudent
              studentLabel="Email"
              sessionHrefBase="/professor/sessions"
              from="case"
            />
          </div>
        )}
      </DefaultTabs>
    </div>
  );
}

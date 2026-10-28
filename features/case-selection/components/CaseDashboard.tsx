"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { SessionsForCaseList } from "@/features/case-sessions/components/SessionsForCaseList";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import { deriveStatus, type CaseSession } from "@/features/case-sessions/models/caseSession";
import { AttemptsPerDayChart } from "@/features/professor/components/charts/AttemptsPerDayChart";
import type { AttemptDayCount } from "@/features/professor/models/dashboard";
import { DefaultTabs } from "@/features/navigation/components/tabs";
import { Select } from "@/features/navigation/components/select";
import { useAuth } from "@/features/auth/services/authService";
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

const SEARCH_INPUT_CLASS =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-brand-800";

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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-3">
        <h4 className="text-2xl font-bold text-gray-800 dark:text-white/90">{value || "—"}</h4>
      </div>
    </div>
  );
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
    <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <div className="my-6">
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
      <button type="button" className={RANK_BUTTON_CLASS} onClick={onAction}>
        {actionLabel}
        <ChevronRight className="size-5 rtl:rotate-180" />
      </button>
    </div>
  );
}

function CaseHeroCard({ caseData }: { caseData: Case }) {
  const imageSrc = /^https?:\/\//.test(String(caseData.imageUrl ?? ""))
    ? String(caseData.imageUrl)
    : "/placeholder.svg";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 sm:h-40 sm:w-40 dark:border-gray-800">
          <Image src={imageSrc} alt={caseData.title} fill className="object-cover" sizes="160px" priority />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{caseData.title}</h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">ID: {caseData.id}</p>
          <div className="mt-3 flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Clock className="mr-1 h-4 w-4" />
            <span>Estimated time: {caseData.estimatedTime} minutes</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Checkbox
              checked={Boolean(caseData.isPublished)}
              disabled
              aria-readonly="true"
              className="size-5 disabled:cursor-default disabled:opacity-100 data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500"
            />
            <span className={caseData.isPublished ? "font-medium text-brand-700 dark:text-brand-400" : "text-muted-foreground"}>
              {caseData.isPublished ? "Published" : "Unpublished"}
            </span>
          </div>
        </div>
      </div>
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
  const { institutionId } = useAuth();
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

  const topYearGroups = useMemo(
    () =>
      rankCounts(
        attempts.map((attempt) => {
          const session = attempt.sessionId ? sessionsById.get(attempt.sessionId) : undefined;
          if (!session?.yearGroupId) {
            return { id: "none", name: "Unassigned" };
          }
          return { id: session.yearGroupId, name: session.yearGroupName ?? "Year group" };
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
      if (query && !(attempt.studentName ?? "").toLowerCase().includes(query)) return false;
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
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
              <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">Description</h3>
              <p className="text-theme-sm text-gray-600 dark:text-gray-400">{caseData.description || "No description."}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
              <MetricCard label="Species" value={caseData.species} />
              <MetricCard label="Category" value={caseData.category} />
              <MetricCard label="Difficulty" value={caseData.difficulty} />
            </div>

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

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <RankingCard
                title="Top Sessions"
                sourceLabel="Session"
                valueLabel="Attempts"
                rows={topSessions}
                emptyMessage="No session attempts yet."
                actionLabel="View Sessions"
                onAction={() => setActiveTab("sessions")}
              />
              <RankingCard
                title="Top Year Groups"
                sourceLabel="Year group"
                valueLabel="Attempts"
                rows={topYearGroups}
                emptyMessage="No year group attempts yet."
                actionLabel="View Attempts"
                onAction={() => setActiveTab("attempts")}
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
              <input
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search by student"
                aria-label="Search by student"
                className={SEARCH_INPUT_CLASS}
              />
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
              sessionHrefBase="/professor/sessions"
            />
          </div>
        )}
      </DefaultTabs>
    </div>
  );
}

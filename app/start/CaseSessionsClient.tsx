"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import { deriveStatus, type CaseSession, type SessionStatus } from "@/features/case-sessions/models/caseSession";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import { studentCaseHref } from "@/features/case-selection/caseViewHref";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import { useAuth } from "@/features/auth/services/authService";
import { YearGroupRequiredAlert } from "@/features/year-groups/components/YearGroupRequiredAlert";

type SessionSortKey = "session" | "case" | "difficulty" | "status" | "start" | "end";
type StatusFilter = "all" | "active" | "scheduled";

const difficultyRank: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
const statusRank: Record<SessionStatus, number> = {
  active: 1,
  scheduled: 2,
  completed: 3,
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: SessionStatus) {
  if (status === "active") return "Active";
  if (status === "scheduled") return "Scheduled";
  return "Completed";
}

function isOpenSession(session: CaseSession) {
  const status = deriveStatus(session);
  return status === "active" || status === "scheduled";
}

function difficultyBadgeVariant(difficulty: string) {
  if (difficulty === "Easy") return "success" as const;
  if (difficulty === "Medium") return "warning" as const;
  return "destructive" as const;
}

export default function CaseSessionsClient() {
  const searchParams = useSearchParams();
  const caseIdParam = searchParams.get("caseId")?.trim() || "";
  const { role, yearGroupId, profileLoading } = useAuth();
  const needsYearGroup = role === "student" && !yearGroupId;

  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [caseTitle, setCaseTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseFilter, setCaseFilter] = useState(caseIdParam || "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  useEffect(() => {
    if (caseIdParam) setCaseFilter(caseIdParam);
  }, [caseIdParam]);

  useEffect(() => {
    if (!caseIdParam) {
      setCaseTitle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const c = await fetchCaseById(caseIdParam);
      if (!cancelled) setCaseTitle(c?.title ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseIdParam]);

  useEffect(() => {
    if (profileLoading) return;
    if (needsYearGroup) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({ status: "all" });
        if (!cancelled) setSessions(list.filter(isOpenSession));
      } catch (e) {
        console.error(e);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsYearGroup, profileLoading]);

  const caseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const session of sessions) {
      if (!seen.has(session.caseId)) {
        seen.set(session.caseId, session.case?.title ?? session.caseId);
      }
    }
    if (caseIdParam && !seen.has(caseIdParam)) {
      seen.set(caseIdParam, caseTitle ?? caseIdParam);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [sessions, caseIdParam, caseTitle]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (caseFilter !== "all" && session.caseId !== caseFilter) return false;
      if (statusFilter !== "all" && deriveStatus(session) !== statusFilter) return false;
      if (difficultyFilter !== "all" && (session.case?.difficulty ?? "") !== difficultyFilter) return false;
      return true;
    });
  }, [sessions, caseFilter, statusFilter, difficultyFilter]);

  const hasActiveFilters = caseFilter !== "all" || statusFilter !== "all" || difficultyFilter !== "all";

  const { sort, toggle, sorted } = useTableSort<CaseSession, SessionSortKey>(
    filteredSessions,
    (session, key) => {
      if (key === "session") return session.friendlyName;
      if (key === "case") return session.case?.title ?? session.caseId;
      if (key === "difficulty") return difficultyRank[session.case?.difficulty ?? ""] ?? 0;
      if (key === "status") return statusRank[deriveStatus(session)] ?? 0;
      if (key === "start") return new Date(session.startAt).getTime();
      return new Date(session.endAt).getTime();
    },
    { key: "start", dir: "asc" },
  );

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={
          caseIdParam
            ? [
                { label: "Home", href: "/dashboard" },
                { label: "Start", href: "/start" },
                { label: caseTitle ?? "Case Sessions" },
              ]
            : [{ label: "Home", href: "/dashboard" }, { label: "Start" }]
        }
      />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Start</h1>
        <p className="mt-4 text-xl text-muted-foreground">Join a session from your professor to attempt a case.</p>
        {caseIdParam ? (
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href={studentCaseHref(caseIdParam)}>View case</Link>
            </Button>
          </div>
        ) : null}

        <div
          role="note"
          className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-start text-sm leading-relaxed text-muted-foreground"
        >
          <p>
            <strong className="text-primary">What is a session?</strong> A session is a timed window your professor opens
            for one clinical case. They choose the case, when it starts and ends, and sometimes an access code. While the
            session is active you can join it and attempt that case by voice or by chat.
          </p>
          <p className="mt-2">
            Every attempt you make is linked to the session, so you can track your own progress and your professor can see
            how the class is doing. Active sessions are open now. Scheduled sessions are listed here so you know what is
            coming — you can join them once they start.
          </p>
        </div>

        {!needsYearGroup ? (
          <div className="mx-auto mt-6 grid w-full max-w-4xl grid-cols-1 gap-3 text-start sm:grid-cols-3">
            <Select
              value={caseFilter}
              onChange={setCaseFilter}
              options={[{ value: "all", label: "All Cases" }, ...caseOptions]}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "scheduled", label: "Scheduled" },
              ]}
            />
            <Select
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              options={[
                { value: "all", label: "All Difficulties" },
                { value: "Easy", label: "Easy" },
                { value: "Medium", label: "Medium" },
                { value: "Hard", label: "Hard" },
              ]}
            />
          </div>
        ) : null}
      </header>

      <YearGroupRequiredAlert className="mb-8" />

      {needsYearGroup ? null : (
        <>
          <p className="mb-2 text-end text-sm text-muted-foreground">
            {profileLoading || loading ? "Loading…" : `${sorted.length} ${sorted.length === 1 ? "session" : "sessions"}`}
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto">
              <div className="min-w-[720px]">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableRow>
                      <SortHeader label="Session" column="session" sort={sort} onSort={toggle} />
                      <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />
                      <SortHeader label="Difficulty" column="difficulty" sort={sort} onSort={toggle} />
                      <SortHeader label="Status" column="status" sort={sort} onSort={toggle} />
                      <SortHeader label="Starts" column="start" sort={sort} onSort={toggle} />
                      <SortHeader label="Ends" column="end" sort={sort} onSort={toggle} />
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {profileLoading || loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                          Loading sessions...
                        </TableCell>
                      </TableRow>
                    ) : sorted.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                          {hasActiveFilters
                            ? "No sessions match these filters."
                            : "No active or scheduled sessions right now. Check back when your professor opens a session."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sorted.map((session) => {
                        const st = deriveStatus(session);
                        const difficulty = session.case?.difficulty ?? "";
                        const imageSrc = /^https?:\/\//.test(String(session.case?.imageUrl ?? ""))
                          ? String(session.case?.imageUrl)
                          : "/placeholder.svg";
                        return (
                          <TableRow
                            key={session.id}
                            className="relative cursor-pointer hover:bg-brand-50 dark:hover:bg-white/[0.03]"
                          >
                            <TableCell className="px-5 py-4 text-start sm:px-6">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 overflow-hidden rounded-full">
                                  <Image src={imageSrc} alt="" width={40} height={40} className="h-10 w-10 object-cover" />
                                </div>
                                <div>
                                  <Link
                                    href={`/start/${session.id}`}
                                    className="block text-theme-sm font-medium text-gray-800 after:absolute after:inset-0 after:z-10 dark:text-white/90"
                                  >
                                    {session.friendlyName}
                                  </Link>
                                  <span className="line-clamp-2 max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
                                    {session.name}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                              {session.case?.title ?? session.caseId}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                              {difficulty ? (
                                <Badge variant={difficultyBadgeVariant(difficulty)}>{difficulty}</Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                              <Badge
                                variant={st === "active" ? "success" : st === "scheduled" ? "warning" : "secondary"}
                                className="capitalize"
                              >
                                {statusLabel(st)}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                              {formatDate(session.startAt)}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                              {formatDate(session.endAt)}
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
        </>
      )}
    </div>
  );
}

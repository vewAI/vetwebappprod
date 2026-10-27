"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listSessions } from "../services/caseSessionService";
import type { CaseSession, SessionStatus } from "../models/caseSession";
import { deriveStatus } from "../models/caseSession";
import { fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { getAccessToken } from "@/lib/auth-headers";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";

type SessionSortKey = "session" | "case" | "year" | "status" | "start" | "end";

function yearLabel(session: CaseSession, yearGroups: YearGroup[]) {
  if (!session.yearGroupName) return "—";
  const showInstitution = new Set(yearGroups.map((group) => group.institutionId)).size > 1;
  const group = yearGroups.find((item) => item.id === session.yearGroupId);
  if (showInstitution && group?.institutionName) {
    return `${group.institutionName} — ${session.yearGroupName}`;
  }
  return session.yearGroupName;
}

const statusRank: Record<SessionStatus, number> = {
  scheduled: 1,
  active: 2,
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

export function SessionList({ initialCaseId }: { initialCaseId?: string }) {
  const [status, setStatus] = useState<"all" | SessionStatus>("all");
  const [caseFilterId, setCaseFilterId] = useState(initialCaseId || "all");
  const [yearFilter, setYearFilter] = useState("all");
  const [creator, setCreator] = useState<"me" | "everyone">("me");
  const [cases, setCases] = useState<Case[]>([]);
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialCaseId) setCaseFilterId(initialCaseId);
  }, [initialCaseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCases({ limit: 200 });
        if (!cancelled) setCases(list);
      } catch {
        if (!cancelled) setCases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/year-groups", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setYearGroups(body.yearGroups ?? []);
      } catch {
        if (!cancelled) setYearGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({
          status,
          caseId: caseFilterId === "all" ? undefined : caseFilterId,
          mine: creator === "me",
          yearGroupId: yearFilter === "all" ? undefined : yearFilter,
        });
        if (!cancelled) setSessions(list);
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
  }, [status, caseFilterId, creator, yearFilter]);

  const { sort, toggle, sorted } = useTableSort<CaseSession, SessionSortKey>(
    sessions,
    (session, key) => {
      if (key === "session") return session.friendlyName;
      if (key === "case") return session.case?.title ?? session.caseId;
      if (key === "year") return yearLabel(session, yearGroups);
      if (key === "status") return statusRank[deriveStatus(session)] ?? 0;
      if (key === "start") return new Date(session.startAt).getTime();
      return new Date(session.endAt).getTime();
    },
    { key: "start", dir: "desc" },
  );

  return (
    <>
      <div className="mx-auto mb-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-start sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={creator}
          onChange={(value) => setCreator(value as typeof creator)}
          selectClassName="border-brand-300 bg-brand-50 font-medium text-brand-700 focus:border-brand-500 dark:border-brand-800 dark:bg-brand-500/12 dark:text-brand-400"
          options={[
            { value: "me", label: "Created By Me" },
            { value: "everyone", label: "Created By Everyone" },
          ]}
        />
        <Select
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "scheduled", label: "Scheduled" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
        />
        <Select
          value={caseFilterId}
          onChange={setCaseFilterId}
          options={[{ value: "all", label: "All Cases" }, ...cases.map((item) => ({ value: item.id, label: item.title }))]}
        />
        <Select
          value={yearFilter}
          onChange={setYearFilter}
          options={[
            { value: "all", label: "All Years" },
            ...yearGroups.map((group) => ({
              value: group.id,
              label:
                yearGroups.some((item) => item.institutionId !== group.institutionId) && group.institutionName
                  ? `${group.institutionName} — ${group.name}`
                  : group.name,
            })),
          ]}
        />
      </div>

      <p className="mb-2 text-end text-sm text-muted-foreground">
        {loading ? "Loading…" : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[720px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Session" column="session" sort={sort} onSort={toggle} />
                  <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />
                  <SortHeader label="Year" column="year" sort={sort} onSort={toggle} />
                  <SortHeader label="Status" column="status" sort={sort} onSort={toggle} />
                  <SortHeader label="Starts" column="start" sort={sort} onSort={toggle} />
                  <SortHeader label="Ends" column="end" sort={sort} onSort={toggle} />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      Loading sessions...
                    </TableCell>
                  </TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      No sessions match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((session) => {
                    const st = deriveStatus(session);
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
                                href={`/professor/sessions/${session.id}`}
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
                          {yearLabel(session, yearGroups)}
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
  );
}

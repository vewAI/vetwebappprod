"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listSessions } from "../services/caseSessionService";
import type { CaseSession, SessionStatus } from "../models/caseSession";
import { deriveStatus } from "../models/caseSession";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import { Loader2 } from "lucide-react";

type Props = {
  caseId: string;
  variant: "start" | "manage";
  sessions?: CaseSession[];
  loading?: boolean;
  emptyMessage?: string;
};

type SessionSortKey = "session" | "createdBy" | "year" | "status" | "start" | "end";

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

export function SessionsForCaseList({
  caseId,
  variant,
  sessions: sessionsProp,
  loading: loadingProp,
  emptyMessage,
}: Props) {
  const [fetchedSessions, setFetchedSessions] = useState<CaseSession[]>([]);
  const [fetchedLoading, setFetchedLoading] = useState(sessionsProp === undefined);
  const isStart = variant === "start";
  const isControlled = sessionsProp !== undefined;
  const sessions = isControlled ? sessionsProp : fetchedSessions;
  const loading = isControlled ? Boolean(loadingProp) : fetchedLoading;

  useEffect(() => {
    if (isControlled) return;
    let cancelled = false;
    (async () => {
      setFetchedLoading(true);
      try {
        const list = await listSessions({
          caseId,
          status: "all",
        });
        if (!cancelled) setFetchedSessions(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setFetchedSessions([]);
      } finally {
        if (!cancelled) setFetchedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, isControlled]);

  const visibleSessions = useMemo(() => {
    const filtered = isStart
      ? sessions.filter((session) => {
          const status = deriveStatus(session);
          return status === "active" || status === "scheduled";
        })
      : sessions;
    const byStart = [...filtered].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );
    return byStart;
  }, [sessions, isStart]);

  const colSpan = isStart ? 4 : 6;

  const { sort, toggle, sorted } = useTableSort<CaseSession, SessionSortKey>(
    visibleSessions,
    (session, key) => {
      if (key === "session") return session.friendlyName;
      if (key === "createdBy") return session.createdByName ?? session.createdBy;
      if (key === "year") return session.yearGroupName ?? "";
      if (key === "status") return statusRank[deriveStatus(session)] ?? 0;
      if (key === "start") return new Date(session.startAt).getTime();
      return new Date(session.endAt).getTime();
    },
    { key: "start", dir: "desc" },
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[720px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <SortHeader label="Session" column="session" sort={sort} onSort={toggle} />
                {!isStart && <SortHeader label="Created By" column="createdBy" sort={sort} onSort={toggle} />}
                {!isStart && <SortHeader label="Year" column="year" sort={sort} onSort={toggle} />}
                <SortHeader label="Status" column="status" sort={sort} onSort={toggle} />
                <SortHeader label="Starts" column="start" sort={sort} onSort={toggle} />
                <SortHeader label="Ends" column="end" sort={sort} onSort={toggle} />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading sessions...
                    </span>
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    {emptyMessage ??
                      (isStart
                        ? "No active or scheduled sessions for this case right now. Check back when your instructor opens a session."
                        : "No sessions for this case yet. Create one to let students join during class.")}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((session) => {
                  const st = deriveStatus(session);
                  const imageSrc = /^https?:\/\//.test(String(session.case?.imageUrl ?? ""))
                    ? String(session.case?.imageUrl)
                    : "/placeholder.svg";
                  const href = isStart ? `/case-sessions/${session.id}` : `/professor/sessions/${session.id}`;
                  return (
                    <TableRow key={session.id} className="relative cursor-pointer hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                      <TableCell className="px-5 py-4 text-start sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-full">
                            <Image src={imageSrc} alt="" width={40} height={40} className="h-10 w-10 object-cover" />
                          </div>
                          <div>
                            <Link
                              href={href}
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
                      {!isStart && (
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {session.createdByName || "—"}
                        </TableCell>
                      )}
                      {!isStart && (
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {session.yearGroupName || "—"}
                        </TableCell>
                      )}
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
  );
}

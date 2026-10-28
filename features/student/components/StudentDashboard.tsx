"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play, User } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { getUserAttempts } from "@/features/attempts/services/attemptService";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { YearGroupRequiredAlert } from "@/features/year-groups/components/YearGroupRequiredAlert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import type { AttemptMonthCount } from "../models/dashboard";
import { AttemptsPerMonthChart } from "./charts/AttemptsPerMonthChart";

function lastTwelveMonths(): AttemptMonthCount[] {
  const months: AttemptMonthCount[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      month,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      attempts: 0,
    });
  }
  return months;
}

function formatCreatedDate(dateString: string | undefined) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatAttemptDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: AttemptSummary["completionStatus"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Abandoned";
}

export function StudentDashboard() {
  const { user, role, loading: authLoading, profileLoading, yearGroupName } = useAuth();
  const isStudent = role === "student";
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStudent || !user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getUserAttempts()
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isStudent, user?.id]);

  const attemptsByMonth = useMemo(() => {
    const points = lastTwelveMonths();
    const counts = new Map(points.map((point) => [point.month, point]));
    for (const attempt of attempts) {
      const month = attempt.createdAt.slice(0, 7);
      const point = counts.get(month);
      if (point) point.attempts += 1;
    }
    return points;
  }, [attempts]);

  const activeAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.completionStatus === "in_progress").slice(0, 3),
    [attempts],
  );

  if (authLoading || profileLoading) {
    return (
      <div className="container mx-auto px-4 pb-8 text-center text-muted-foreground">Loading dashboard...</div>
    );
  }

  if (!isStudent) {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">You must be a student to view this page.</p>
      </div>
    );
  }

  const email = user?.email ?? "—";
  const createdAt = typeof user?.created_at === "string" ? user.created_at : undefined;

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Student Dashboard</h1>
        <p className="mt-4 text-xl text-muted-foreground">Your profile, recent practice, and a quick way to start a case.</p>
      </header>

      <YearGroupRequiredAlert className="mb-8" />

      <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Card>
          <CardContent className="flex items-center gap-4 py-2">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">
              <User className="size-8" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">{email}</p>
              <p className="mt-1 text-sm text-muted-foreground">Created {formatCreatedDate(createdAt)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{yearGroupName ?? "Year group not assigned"}</p>
            </div>
          </CardContent>
        </Card>

        <Button
          asChild
          size="lg"
          className="h-full min-h-[5.5rem] w-full bg-brand-500 text-base font-semibold text-white hover:bg-brand-600"
        >
          <Link href="/start">
            <Play className="size-5" aria-hidden="true" />
            Start
          </Link>
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Attempts Per Month</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading chart...</p>
          ) : (
            <AttemptsPerMonthChart data={attemptsByMonth} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Active Attempts</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/attempts">View all</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 sm:px-6 dark:text-gray-400">
                      Case
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      View
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                        Loading attempts...
                      </TableCell>
                    </TableRow>
                  ) : activeAttempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                        You have no attempts in progress.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeAttempts.map((attempt) => {
                      const href = `/attempts/${attempt.id}`;
                      return (
                        <TableRow key={attempt.id} className="relative hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                          <TableCell className="px-5 py-4 text-start sm:px-6">
                            <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{attempt.caseTitle}</p>
                            <p className="line-clamp-1 text-theme-xs text-gray-500 dark:text-gray-400">{attempt.title}</p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-start">
                            <Badge variant="warning">{statusLabel(attempt.completionStatus)}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                            {formatAttemptDate(attempt.createdAt)}
                          </TableCell>
                          <TableCell className="relative z-20 px-4 py-3 text-end">
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
        </CardContent>
      </Card>
    </div>
  );
}

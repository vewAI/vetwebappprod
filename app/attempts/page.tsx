"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { getUserAttempts } from "@/features/attempts/services/attemptService";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import type { AttemptSummary } from "@/features/attempts/models/attempt";

type AttemptSortKey = "case" | "status" | "difficulty" | "date" | "time";

const difficultyRank: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
const statusRank: Record<AttemptSummary["completionStatus"], number> = {
  in_progress: 1,
  completed: 2,
  abandoned: 3,
};

function formatDate(dateString: string) {
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

function AttemptsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const caseIdParam = searchParams.get("caseId")?.trim() || "";
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [caseFilter, setCaseFilter] = useState(caseIdParam || "all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const loadAttempts = async () => {
      if (!user) return;
      setIsLoading(true);
      const userAttempts = await getUserAttempts();
      setAttempts(userAttempts);
      setIsLoading(false);
    };
    loadAttempts();
  }, [user]);

  useEffect(() => {
    if (caseIdParam) setCaseFilter(caseIdParam);
  }, [caseIdParam]);

  const caseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const attempt of attempts) {
      if (!seen.has(attempt.caseId)) {
        seen.set(attempt.caseId, attempt.caseTitle || attempt.title);
      }
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      if (caseFilter !== "all" && attempt.caseId !== caseFilter) return false;
      if (statusFilter !== "all" && attempt.completionStatus !== statusFilter) return false;
      return true;
    });
  }, [attempts, caseFilter, statusFilter]);

  const { sort, toggle, sorted: sortedAttempts } = useTableSort<AttemptSummary, AttemptSortKey>(
    filteredAttempts,
    (attempt, key) => {
      if (key === "case") return attempt.caseTitle;
      if (key === "status") return statusRank[attempt.completionStatus] ?? 0;
      if (key === "difficulty") return difficultyRank[attempt.caseDifficulty] ?? 0;
      if (key === "date") return new Date(attempt.createdAt).getTime();
      return attempt.timeSpentSeconds;
    },
    { key: "date", dir: "desc" },
  );

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "My Attempts" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">My Attempts</h1>
        <p className="mt-4 text-xl text-muted-foreground">View and manage your past case attempts</p>

        <div className="mx-auto mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 text-start sm:grid-cols-2">
          <Select
            value={caseFilter}
            onChange={setCaseFilter}
            options={[{ value: "all", label: "All Cases" }, ...caseOptions]}
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
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[720px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />
                  <SortHeader label="Status" column="status" sort={sort} onSort={toggle} />
                  <SortHeader label="Difficulty" column="difficulty" sort={sort} onSort={toggle} />
                  <SortHeader label="Date" column="date" sort={sort} onSort={toggle} />
                  <SortHeader label="Time" column="time" sort={sort} onSort={toggle} />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      Loading attempts...
                    </TableCell>
                  </TableRow>
                ) : sortedAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      {caseFilter !== "all" || statusFilter !== "all"
                        ? "No attempts match these filters."
                        : "You have not attempted a case yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAttempts.map((attempt) => {
                    const imageSrc = /^https?:\/\//.test(String(attempt.caseImageUrl ?? ""))
                      ? String(attempt.caseImageUrl)
                      : "/placeholder.svg";
                    const href = `/attempts/${attempt.id}`;
                    return (
                      <TableRow
                        key={attempt.id}
                        className="relative cursor-pointer hover:bg-brand-50 dark:hover:bg-white/[0.03]"
                      >
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
                                {attempt.caseTitle}
                              </Link>
                              <span className="line-clamp-2 max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
                                {attempt.title}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
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
                          <Badge
                            variant={
                              attempt.caseDifficulty === "Easy"
                                ? "success"
                                : attempt.caseDifficulty === "Medium"
                                  ? "warning"
                                  : "destructive"
                            }
                            className={attempt.caseDifficulty === "Hard" ? "text-white" : undefined}
                          >
                            {attempt.caseDifficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {formatDate(attempt.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                          {formatTimeSpent(attempt.timeSpentSeconds)}
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
    </div>
  );
}

export default function AttemptsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 pb-8 text-center text-muted-foreground">Loading attempts...</div>
      }
    >
      <AttemptsPageContent />
    </Suspense>
  );
}

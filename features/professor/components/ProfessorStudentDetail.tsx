"use client";

import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Select } from "@/features/navigation/components/select";
import { AttemptsPerMonthChart } from "@/features/student/components/charts/AttemptsPerMonthChart";
import type { AttemptMonthCount } from "@/features/student/models/dashboard";
import { defaultAcademicYearEnd, isAfterAcademicYearCutoff } from "@/features/year-groups/models/yearGroup";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import type { ProfessorStudentDetail as StudentDetail } from "../models/student";

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

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function ProfessorStudentDetail({ studentId }: { studentId: string }) {
  const { role, loading: authLoading, institutionId } = useAuth();
  const isStaff = role === "professor" || role === "admin";
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [caseFilter, setCaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [academicYearFilter, setAcademicYearFilter] = useState<"current" | "anytime">("current");
  const [academicYearEnd, setAcademicYearEnd] = useState(defaultAcademicYearEnd);

  useEffect(() => {
    if (!isStaff || !studentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");
        const res = await fetch(`/api/professor/students/${encodeURIComponent(studentId)}`, {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json()) as StudentDetail & { error?: string };
        if (!res.ok) throw new Error(body.error || res.statusText);
        if (!cancelled) setStudent(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load student");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, studentId]);

  useEffect(() => {
    if (!isStaff) return;
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
        // Keep the 31 July default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, institutionId]);

  const attemptsByMonth = useMemo(() => {
    const points = lastTwelveMonths();
    const counts = new Map(points.map((point) => [point.month, point]));
    for (const attempt of student?.attempts ?? []) {
      const month = attempt.createdAt.slice(0, 7);
      const point = counts.get(month);
      if (point) point.attempts += 1;
    }
    return points;
  }, [student?.attempts]);

  const yearOptions = useMemo(() => {
    const options = [{ value: "all", label: "All Year Groups" }];
    const seen = new Map<string, string>();
    for (const attempt of student?.attempts ?? []) {
      if (!attempt.sessionYearGroupId || seen.has(attempt.sessionYearGroupId)) continue;
      seen.set(attempt.sessionYearGroupId, attempt.sessionYearGroupName || "Year group");
    }
    for (const [value, label] of seen) options.push({ value, label });
    if ((student?.attempts ?? []).some((attempt) => !attempt.sessionYearGroupId)) {
      options.push({ value: "none", label: "Unassigned" });
    }
    return options;
  }, [student?.attempts]);

  const caseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const attempt of student?.attempts ?? []) {
      if (!attempt.caseId || seen.has(attempt.caseId)) continue;
      seen.set(attempt.caseId, attempt.caseTitle || attempt.title || "Case");
    }
    return [{ value: "all", label: "All Cases" }, ...[...seen.entries()].map(([value, label]) => ({ value, label }))];
  }, [student?.attempts]);

  const filteredAttempts = useMemo(() => {
    const attempts = student?.attempts ?? [];
    return attempts.filter((attempt) => {
      if (yearFilter !== "all" && (attempt.sessionYearGroupId ?? "none") !== yearFilter) return false;
      if (caseFilter !== "all" && attempt.caseId !== caseFilter) return false;
      if (statusFilter !== "all" && attempt.completionStatus !== statusFilter) return false;
      if (
        academicYearFilter === "current" &&
        !isAfterAcademicYearCutoff(attempt.createdAt, academicYearEnd.month, academicYearEnd.day)
      ) {
        return false;
      }
      return true;
    });
  }, [student?.attempts, yearFilter, caseFilter, statusFilter, academicYearFilter, academicYearEnd.month, academicYearEnd.day]);

  if (authLoading || loading) {
    return <div className="container mx-auto px-4 pb-8 text-center text-muted-foreground">Loading student...</div>;
  }

  if (!isStaff) {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">Only professors and admins can view students.</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="container mx-auto px-4 pb-8">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Students", href: "/professor/students" }, { label: "Student" }]} />
        <h1 className="text-xl font-bold text-destructive">Student not found</h1>
        <p className="mt-2 text-muted-foreground">{error || "This student could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Students", href: "/professor/students" },
          { label: student.email || "Student" },
        ]}
      />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">{student.email || "Student"}</h1>
        <p className="mt-4 text-xl text-muted-foreground">Profile, monthly attempt volume, and every attempt.</p>
      </header>

      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">
            <User className="size-8" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">{student.email || "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Joined {formatDate(student.createdAt)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Last sign in {formatDate(student.lastSignInAt, true)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{student.yearGroupName ?? "Year group not assigned"}</p>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-5 sm:px-6 sm:pt-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4">
          <h3 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Attempts Per Month</h3>
          <span className="block text-theme-sm text-gray-500 dark:text-gray-400">Last 12 months</span>
        </div>
        <AttemptsPerMonthChart data={attemptsByMonth} />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="px-6 py-5">
          <h3 className="text-base font-medium text-primary dark:text-white/90">Attempts</h3>
        </div>
        <div className="space-y-4 border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={yearFilter} onChange={setYearFilter} options={yearOptions} />
            <Select value={caseFilter} onChange={setCaseFilter} options={caseOptions} />
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
            <Select
              value={academicYearFilter}
              onChange={(value) => setAcademicYearFilter(value as "current" | "anytime")}
              options={[
                { value: "current", label: "Current Academic Year" },
                { value: "anytime", label: "Anytime" },
              ]}
            />
          </div>
          <p className="text-end text-sm text-muted-foreground">
            {filteredAttempts.length} {filteredAttempts.length === 1 ? "attempt" : "attempts"}
          </p>
          <CaseAttemptsTable
            attempts={filteredAttempts}
            emptyMessage={
              student.attempts.length === 0
                ? "This student has not attempted a case yet."
                : "No attempts match these filters."
            }
            showCase
            sessionHrefBase="/professor/sessions"
            from="student"
          />
        </div>
      </div>
    </div>
  );
}

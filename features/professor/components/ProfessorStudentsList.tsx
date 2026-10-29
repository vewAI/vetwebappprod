"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Pagination } from "@/features/navigation/components/pagination";
import { FilterSearch } from "@/features/navigation/components/filter-search";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import type { TableSort } from "@/features/navigation/models/table-sort";
import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
import type { YearGroup } from "@/features/year-groups/models/yearGroup";
import type { ProfessorStudentRow } from "../models/student";

type StudentSortKey = "email" | "joined";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProfessorStudentsList() {
  const { role, loading: authLoading } = useAuth();
  const isStaff = role === "professor" || role === "admin";
  const [students, setStudents] = useState<ProfessorStudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TableSort<StudentSortKey>>({ key: "email", dir: "asc" });
  const prevEmailQuery = useRef("");

  useEffect(() => {
    const next = emailSearch.trim();
    const timeout = window.setTimeout(() => {
      if (next === prevEmailQuery.current) return;
      prevEmailQuery.current = next;
      setDebouncedEmail(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [emailSearch]);

  useEffect(() => {
    if (!isStaff) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");
        const res = await fetch("/api/year-groups", {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json()) as { yearGroups?: YearGroup[]; error?: string };
        if (!cancelled) setYearGroups(body.yearGroups ?? []);
      } catch {
        if (!cancelled) setYearGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) {
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
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sort: sort.key,
          dir: sort.dir,
        });
        if (debouncedEmail) params.set("email", debouncedEmail);
        if (yearFilter !== "all") params.set("yearGroupId", yearFilter);
        const res = await fetch(`/api/professor/students?${params}`, {
          headers: await buildAuthHeaders({ Accept: "application/json" }, token),
        });
        const body = (await res.json()) as { students?: ProfessorStudentRow[]; total?: number; error?: string };
        if (!res.ok) throw new Error(body.error || res.statusText);
        if (!cancelled) {
          setStudents(body.students ?? []);
          setTotal(body.total ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, page, debouncedEmail, yearFilter, sort]);

  const yearFilterOptions = useMemo(() => {
    const showInstitution = new Set(yearGroups.map((group) => group.institutionId)).size > 1;
    return [
      { value: "all", label: "All Year Groups" },
      { value: "unassigned", label: "Unassigned" },
      ...yearGroups.map((group) => ({
        value: group.id,
        label: showInstitution && group.institutionName ? `${group.institutionName} — ${group.name}` : group.name,
      })),
    ];
  }, [yearGroups]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (key: StudentSortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };

  if (authLoading) {
    return <div className="container mx-auto px-4 pb-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!isStaff) {
    return (
      <div className="container mx-auto px-4 pb-8 text-center">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Students" }]} />
        <h1 className="text-xl font-bold text-destructive">Access denied</h1>
        <p className="mt-2 text-muted-foreground">Only professors and admins can search students.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Students" }]} />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Students</h1>
        <p className="mt-4 text-xl text-muted-foreground">Search students by email and year group.</p>
        <div className="mx-auto mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 text-start sm:grid-cols-2">
          <FilterSearch value={emailSearch} onChange={setEmailSearch} placeholder="Search by email" />
          <Select
            value={yearFilter}
            onChange={(value) => {
              setYearFilter(value);
              setPage(1);
            }}
            options={yearFilterOptions}
          />
        </div>
      </header>

      {error ? <p className="mb-6 text-center text-sm text-destructive">{error}</p> : null}

      <p className="mb-2 text-end text-sm text-muted-foreground">
        {loading ? "Loading…" : `${total} ${total === 1 ? "student" : "students"}`}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[720px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Email" column="email" sort={sort} onSort={toggleSort} />
                  <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                    Year
                  </TableCell>
                  <SortHeader label="Joined" column="joined" sort={sort} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      Loading students...
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      No students match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.userId} className="relative cursor-pointer hover:bg-brand-50 dark:hover:bg-white/[0.03]">
                      <TableCell className="px-5 py-4 text-start sm:px-6">
                        <Link
                          href={`/professor/students/${student.userId}`}
                          className="block text-theme-sm font-medium text-gray-800 after:absolute after:inset-0 after:z-10 dark:text-white/90"
                        >
                          {student.email || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {student.yearGroupName || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatDate(student.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        {total > PAGE_SIZE ? (
          <div className="border-t border-gray-100 dark:border-white/[0.05]">
            <Pagination page={Math.min(page, totalPages)} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

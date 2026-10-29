"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { fetchCases, fetchDisciplines } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { Badge } from "@/components/ui/badge";
import { caseFieldMeta } from "@/features/cases/fieldMeta";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";
import { buildAuthHeaders } from "@/lib/auth-headers";

type CaseSortKey = "case" | "species" | "discipline" | "difficulty" | "time" | "published" | "author" | "created";

const difficultyRank: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
const caseDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/London" });

export function CaseLibrary({
  getCaseHref,
  title = "Clinical Cases",
  subtitle = "Explore the full library of OSCE-style veterinary cases.",
  showPublished = false,
  showAuthorship = false,
  includeUnpublished = false,
}: {
  getCaseHref: (caseItem: Case) => string;
  title?: string;
  subtitle?: string;
  showPublished?: boolean;
  showAuthorship?: boolean;
  includeUnpublished?: boolean;
}) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const { user, role } = useAuth();
  const [hasAssignedCases, setHasAssignedCases] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const disc = await fetchDisciplines();
      setDisciplines(disc);
    }
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAssigned() {
      if (!user?.id || role !== "student") return;
      try {
        const { professorService } = await import("@/features/professor/services/professorService");
        const assigned = await professorService.getAssignedCasesForStudent(user.id);
        if (!cancelled) setHasAssignedCases(Array.isArray(assigned) && assigned.length > 0);
      } catch (err) {
        console.warn("Failed to check assigned cases", err);
        if (!cancelled) setHasAssignedCases(false);
      }
    }
    checkAssigned();
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  useEffect(() => {
    let cancelled = false;
    async function loadCases() {
      setLoading(true);
      try {
        if (selectedDiscipline === "assigned" && user?.id && role === "student") {
          const { professorService } = await import("@/features/professor/services/professorService");
          const assigned = await professorService.getAssignedCasesForStudent(user.id);
          const mapped = Array.isArray(assigned)
            ? assigned.map((entry: { case?: Case }) => entry.case).filter((caseItem): caseItem is Case => Boolean(caseItem))
            : [];
          if (!cancelled) setCases(mapped);
        } else {
          let result = await fetchCases({
            category: selectedDiscipline === "all" ? undefined : selectedDiscipline,
            species: selectedSpecies === "all" ? undefined : selectedSpecies,
            includeUnpublished,
          });
          if (showAuthorship) {
            const userIds = [...new Set(result.map((caseItem) => caseItem.creatorUserId).filter((id): id is string => Boolean(id)))];
            let names: Record<string, string> = {};
            let lookupFailed = false;
            if (userIds.length > 0) {
              try {
                const response = await fetch("/api/cases/author-names", {
                  method: "POST",
                  headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
                  body: JSON.stringify({ userIds }),
                });
                if (!response.ok) throw new Error(`Author lookup failed (${response.status})`);
                const payload = await response.json() as { names?: Record<string, string> };
                names = payload.names ?? {};
              } catch (authorError) {
                console.warn("Failed to load case author names", authorError);
                lookupFailed = true;
              }
            }
            result = result.map((caseItem) => ({
              ...caseItem,
              creatorName: !caseItem.creatorUserId ? "Unknown" : lookupFailed ? "Unavailable" : names[caseItem.creatorUserId] ?? "Unknown",
            }));
          }
          if (!cancelled) setCases(result);
        }
      } catch (err) {
        console.warn("Failed to load cases for selected filter", err);
        if (!cancelled) setCases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCases();
    return () => { cancelled = true; };
  }, [selectedDiscipline, selectedSpecies, user, role, includeUnpublished, showAuthorship]);

  const { sort, toggle, sorted: sortedCases } = useTableSort<Case, CaseSortKey>(
    cases,
    (caseItem, key) => {
      if (key === "case") return caseItem.title;
      if (key === "species") return caseItem.species;
      if (key === "discipline") return caseItem.category;
      if (key === "difficulty") return difficultyRank[caseItem.difficulty] ?? 0;
      if (key === "published") return caseItem.isPublished ? 1 : 0;
      if (key === "author") return caseItem.creatorName ?? "";
      if (key === "created") return caseItem.createdAt ?? "";
      return caseItem.estimatedTime;
    },
    { key: "case", dir: "asc" },
  );

  return (
    <>
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{subtitle}</p>

        <div className="mx-auto mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 text-start sm:grid-cols-2">
          <Select
            value={selectedDiscipline}
            onChange={setSelectedDiscipline}
            options={[
              { value: "all", label: "All Disciplines" },
              ...(hasAssignedCases ? [{ value: "assigned", label: "My Assignments" }] : []),
              ...disciplines.map((discipline) => ({ value: discipline, label: discipline })),
            ]}
          />
          <Select
            value={selectedSpecies}
            onChange={setSelectedSpecies}
            options={[
              { value: "all", label: "All Species" },
              ...(caseFieldMeta.species.options ?? []).map((species) => ({ value: species, label: species })),
            ]}
          />
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className={showAuthorship ? "min-w-[1100px]" : showPublished ? "min-w-[840px]" : "min-w-[720px]"}>
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />
                  <SortHeader label="Species" column="species" sort={sort} onSort={toggle} />
                  <SortHeader label="Discipline" column="discipline" sort={sort} onSort={toggle} />
                  <SortHeader label="Difficulty" column="difficulty" sort={sort} onSort={toggle} />
                  <SortHeader label="Time" column="time" sort={sort} onSort={toggle} />
                  {showAuthorship ? <SortHeader label="Created by" column="author" sort={sort} onSort={toggle} /> : null}
                  {showAuthorship ? <SortHeader label="Date created" column="created" sort={sort} onSort={toggle} /> : null}
                  {showPublished ? <SortHeader label="Published" column="published" sort={sort} onSort={toggle} /> : null}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5 + (showPublished ? 1 : 0) + (showAuthorship ? 2 : 0)}
                      className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                    >
                      Loading cases...
                    </TableCell>
                  </TableRow>
                ) : cases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5 + (showPublished ? 1 : 0) + (showAuthorship ? 2 : 0)}
                      className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                    >
                      No cases match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCases.map((caseItem) => {
                    const imageSrc = /^https?:\/\//.test(String(caseItem.imageUrl ?? ""))
                      ? String(caseItem.imageUrl)
                      : "/placeholder.svg";
                    return (
                      <TableRow
                        key={caseItem.id}
                        className="relative cursor-pointer hover:bg-brand-50 dark:hover:bg-white/[0.03]"
                      >
                        <TableCell className="px-5 py-4 text-start sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-full">
                              <Image src={imageSrc} alt="" width={40} height={40} className="h-10 w-10 object-cover" />
                            </div>
                            <div>
                              <Link
                                href={getCaseHref(caseItem)}
                                className="block text-theme-sm font-medium text-gray-800 after:absolute after:inset-0 after:z-10 dark:text-white/90"
                              >
                                {caseItem.title}
                              </Link>
                              <span className="line-clamp-2 max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
                                {caseItem.description}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {caseItem.species}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          {caseItem.category}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                          <Badge
                            variant={
                              caseItem.difficulty === "Easy" ? "success" : caseItem.difficulty === "Medium" ? "warning" : "destructive"
                            }
                            className={caseItem.difficulty === "Hard" ? "text-white" : undefined}
                          >
                            {caseItem.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                          {caseItem.estimatedTime} min
                        </TableCell>
                        {showAuthorship ? (
                          <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                            {caseItem.creatorName ?? "Unknown"}
                          </TableCell>
                        ) : null}
                        {showAuthorship ? (
                          <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400">
                            {caseItem.createdAt && !Number.isNaN(Date.parse(caseItem.createdAt))
                              ? caseDateFormatter.format(new Date(caseItem.createdAt))
                              : "Unknown"}
                          </TableCell>
                        ) : null}
                        {showPublished ? (
                          <TableCell className="px-4 py-3">
                            {caseItem.isPublished ? (
                              <Check className="size-5 text-brand-600" strokeWidth={2.5} aria-label="Published" />
                            ) : (
                              <X className="size-5 text-gray-400" strokeWidth={2.5} aria-label="Unpublished" />
                            )}
                          </TableCell>
                        ) : null}
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

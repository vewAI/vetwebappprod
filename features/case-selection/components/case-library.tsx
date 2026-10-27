"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { fetchCases, fetchDisciplines } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { Badge } from "@/components/ui/badge";
import { caseFieldMeta } from "@/features/cases/fieldMeta";
import { Select } from "@/features/navigation/components/select";
import { SortHeader } from "@/features/navigation/components/sort-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/features/navigation/components/table";
import { useTableSort } from "@/features/navigation/hooks/useTableSort";

type CaseSortKey = "case" | "species" | "discipline" | "difficulty" | "time";

const difficultyRank: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

export function CaseLibrary({
  getCaseHref,
  title = "Clinical Cases",
  subtitle = "Explore the full library of OSCE-style veterinary cases.",
}: {
  getCaseHref: (caseItem: Case) => string;
  title?: string;
  subtitle?: string;
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
    async function loadCases() {
      setLoading(true);
      try {
        if (selectedDiscipline === "assigned" && user?.id && role === "student") {
          const { professorService } = await import("@/features/professor/services/professorService");
          const assigned = await professorService.getAssignedCasesForStudent(user.id);
          const mapped = Array.isArray(assigned)
            ? assigned.map((entry: { case?: Case }) => entry.case).filter((caseItem): caseItem is Case => Boolean(caseItem))
            : [];
          setCases(mapped);
        } else {
          const result = await fetchCases({
            category: selectedDiscipline === "all" ? undefined : selectedDiscipline,
            species: selectedSpecies === "all" ? undefined : selectedSpecies,
          });
          setCases(result);
        }
      } catch (err) {
        console.warn("Failed to load cases for selected filter", err);
        setCases([]);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, [selectedDiscipline, selectedSpecies, user, role]);

  const { sort, toggle, sorted: sortedCases } = useTableSort<Case, CaseSortKey>(
    cases,
    (caseItem, key) => {
      if (key === "case") return caseItem.title;
      if (key === "species") return caseItem.species;
      if (key === "discipline") return caseItem.category;
      if (key === "difficulty") return difficultyRank[caseItem.difficulty] ?? 0;
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
          <div className="min-w-[720px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <SortHeader label="Case" column="case" sort={sort} onSort={toggle} />
                  <SortHeader label="Species" column="species" sort={sort} onSort={toggle} />
                  <SortHeader label="Discipline" column="discipline" sort={sort} onSort={toggle} />
                  <SortHeader label="Difficulty" column="difficulty" sort={sort} onSort={toggle} />
                  <SortHeader label="Time" column="time" sort={sort} onSort={toggle} />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                      Loading cases...
                    </TableCell>
                  </TableRow>
                ) : cases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-5 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
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

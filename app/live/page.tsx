"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/features/auth/services/authService";
import {
  fetchCases,
  fetchDisciplines,
} from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, ChevronRight, ArrowLeft, Filter } from "lucide-react";

export default function LiveCaseSelectionPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const { user } = useAuth();

  useEffect(() => {
    async function loadData() {
      const disc = await fetchDisciplines();
      setDisciplines(disc);
    }
    loadData();
  }, []);

  useEffect(() => {
    async function loadCases() {
      setLoading(true);
      try {
        const result = await fetchCases({
          category:
            selectedDiscipline === "all" ? undefined : selectedDiscipline,
        });
        setCases(result);
      } catch {
        setCases([]);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, [selectedDiscipline]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-2">
        <Link
          href="/cases"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Cases
        </Link>
      </div>

      <header className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Radio className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Live Sessions
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Voice-first clinical simulation. Choose a case and speak directly with
          the patient owner, veterinary nurse, and lab technician in real time.
        </p>
      </header>

      {/* Filter */}
      {disciplines.length > 1 && (
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
            >
              <option value="all">All Disciplines</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Case Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading cases...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">No cases available</p>
          <Link href="/cases">
            <Button variant="outline">Browse all cases</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Link
              key={caseItem.id}
              href={`/live/${caseItem.id}`}
              className="group"
            >
              <div className="flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/30">
                {/* Image */}
                <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={
                      /^https?:\/\//.test(String(caseItem.imageUrl ?? ""))
                        ? String(caseItem.imageUrl)
                        : "/placeholder.svg"
                    }
                    alt={caseItem.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="400px"
                  />
                  {/* Live badge */}
                  <div className="absolute left-3 top-3">
                    <div className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      LIVE
                    </div>
                  </div>
                  {/* Difficulty */}
                  {caseItem.difficulty && (
                    <div className="absolute right-3 top-3">
                      <Badge
                        variant={
                          caseItem.difficulty === "Easy"
                            ? "success"
                            : caseItem.difficulty === "Medium"
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {caseItem.difficulty}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold leading-tight mb-1 group-hover:text-primary transition-colors">
                    {caseItem.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {caseItem.species} &middot; {caseItem.category}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    {caseItem.description}
                  </p>
                  <div className="mt-3 flex items-center text-sm font-medium text-primary">
                    Start Live Session
                    <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { CaseCard } from "@/features/case-selection/components/case-card";
import { useEffect, useState } from "react";
import { fetchCases, fetchDisciplines } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { GuidedTour } from "@/components/ui/guided-tour";
import { HelpTip } from "@/components/ui/help-tip";

export default function CaseSelectionPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");

  const tourSteps = [
    { element: '#main-title', popover: { title: 'Welcome', description: 'Welcome to the Veterinary OSCE Simulator. Here you can practice your clinical skills.' } },
    { element: '#discipline-filter', popover: { title: 'Filter Cases', description: 'Use this dropdown to filter cases by discipline (e.g., Internal Medicine, Surgery).' } },
    { element: '#case-grid', popover: { title: 'Select a Case', description: 'Browse the available cases and click "View Case" to start.' } },
  ];

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
      const result = await fetchCases({
        category: selectedDiscipline === "all" ? undefined : selectedDiscipline
      });
      setCases(result);
      setLoading(false);
    }
    loadCases();
  }, [selectedDiscipline]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="absolute top-4 right-4">
        <GuidedTour steps={tourSteps} tourId="main-page" autoStart={true} />
      </div>
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 id="main-title" className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
            Veterinary OSCE Simulator
          </h1>
          <HelpTip content="This is the main dashboard where you can select clinical cases to practice." />
        </div>
        <p className="mt-4 text-xl text-muted-foreground">
          Select a case to begin your clinical examination
        </p>
        
        <div className="mt-6 flex justify-center items-center gap-2">
          <div id="discipline-filter" className="w-full max-w-xs">
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
            >
              <option value="all">Show All Cases</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <HelpTip content="Filter the list of cases by medical discipline." />
        </div>
      </header>

      {loading ? (
        <div className="p-8 text-center">Loading cases...</div>
      ) : (
        <div id="case-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <CaseCard key={caseItem.id} caseItem={caseItem} />
          ))}
        </div>
      )}
    </div>
  );
}

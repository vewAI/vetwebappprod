"use client";

import { CaseCard } from "@/features/case-selection/components/case-card";
import { useEffect, useState } from "react";
import { fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";

export default function CaseSelectionPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCases() {
      setLoading(true);
      const result = await fetchCases();
      setCases(result);
      setLoading(false);
    }
    loadCases();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
          Veterinary OSCE Simulator
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Select a case to begin your clinical examination
        </p>
      </header>

      {loading ? (
        <div className="p-8 text-center">Loading cases...</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <CaseCard key={caseItem.id} caseItem={caseItem} />
          ))}
        </div>
      )}
    </div>
  );
}

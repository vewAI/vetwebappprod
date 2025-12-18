"use client";

import { useEffect, useState } from "react";
import { fetchCases, fetchAssignedCases } from "@/features/case-selection/services/caseService";
import { CaseCard } from "@/features/case-selection/components/case-card";
import type { Case } from "@/features/case-selection/models/case";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function CaseSelectionPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [assignedCases, setAssignedCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCases() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const [allCases, assigned] = await Promise.all([
            fetchCases({ includeUnpublished: true }),
            user ? fetchAssignedCases(user.id) : Promise.resolve([])
        ]);
        
        setCases(allCases);
        setAssignedCases(assigned);
      } catch (err) {
        console.error("Failed to load cases", err);
        setError("Failed to load cases. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadCases();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Browse Cases</h1>
      
      {assignedCases.length > 0 && (
        <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-blue-700">Assigned to You</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assignedCases.map((caseItem) => (
                <CaseCard key={caseItem.id} caseItem={caseItem} />
            ))}
            </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No cases found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cases.map((caseItem) => (
            <CaseCard key={caseItem.id} caseItem={caseItem} />
          ))}
        </div>
      )}
    </div>
  );
}

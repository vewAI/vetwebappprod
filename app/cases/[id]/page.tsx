"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { getCaseAttemptsForStaff } from "@/features/attempts/services/attemptService";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { CaseDashboard } from "@/features/case-selection/components/CaseDashboard";
import { studentCaseHref } from "@/features/case-selection/caseViewHref";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";

export default function ManageCasePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const isStaff = role === "professor" || role === "admin";
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [caseLoaded, setCaseLoaded] = useState(false);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isStaff) {
      router.replace(studentCaseHref(id));
    }
  }, [authLoading, isStaff, id, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchCaseById(id);
      if (!cancelled) {
        setCaseData(result);
        setCaseLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user || !isStaff) return;
    let cancelled = false;
    (async () => {
      setAttemptsLoading(true);
      try {
        const list = await getCaseAttemptsForStaff(id);
        if (!cancelled) setAttempts(list);
      } catch (error) {
        console.error("Error loading case attempts:", error);
        if (!cancelled) setAttempts([]);
      } finally {
        if (!cancelled) setAttemptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, isStaff]);

  if (authLoading || !isStaff) {
    return (
      <div className="container mx-auto px-4 pb-8 text-muted-foreground">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Cases", href: "/cases" }, { label: "Case" }]} />
        Loading case...
      </div>
    );
  }

  if (caseLoaded && !caseData) {
    return (
      <div className="container mx-auto px-4 pb-8">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Cases", href: "/cases" }, { label: "Case not found" }]} />
        <div className="py-12 text-center">
          <p className="text-lg">Case not found</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 pb-8 text-muted-foreground">
        <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Cases", href: "/cases" }, { label: "Case" }]} />
        Loading case...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Cases", href: "/cases" },
          { label: caseData.title },
        ]}
      />
      <CaseDashboard
        caseId={id}
        caseData={caseData}
        attempts={attempts}
        attemptsLoading={attemptsLoading}
      />
    </div>
  );
}

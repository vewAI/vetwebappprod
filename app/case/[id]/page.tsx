"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/services/authService";
import { getCaseAttemptsForStaff } from "@/features/attempts/services/attemptService";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { CaseDetails } from "@/features/case-selection/components/CaseDetails";
import { CaseAttemptsTable } from "@/features/attempts/components/CaseAttemptsTable";
import { SessionsForCaseList } from "@/features/case-sessions/components/SessionsForCaseList";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { Button } from "@/components/ui/button";

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
      router.replace(`/case/${id}/instructions`);
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

  const recentAttempts = useMemo(
    () =>
      [...attempts]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [attempts],
  );

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

      <div className="mb-8">
        <CaseDetails caseData={caseData} />

        <div className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-primary">Latest Attempts</h2>
          <CaseAttemptsTable
            attempts={recentAttempts}
            loading={attemptsLoading}
            emptyMessage="No attempts on this case yet."
            showStudent
            sessionHrefBase="/professor/sessions"
          />
        </div>

        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-primary">Latest Sessions</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/professor/sessions?caseId=${encodeURIComponent(id)}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all sessions
              </Link>
              <Button size="sm" asChild>
                <Link href={`/professor/sessions/new?caseId=${encodeURIComponent(id)}`}>Create session</Link>
              </Button>
            </div>
          </div>
          <SessionsForCaseList caseId={id} variant="manage" />
        </div>
      </div>
    </div>
  );
}

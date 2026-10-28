"use client";

import React, { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { deriveStatus } from "../models/caseSession";
import { useCaseSessionDetail } from "../hooks/useCaseSessionDetail";
import { generateSessionReport } from "../services/caseSessionService";
import { SessionCasePanel } from "./SessionCasePanel";
import { SessionInfoPanel } from "./SessionInfoPanel";
import { ProfessorSessionAttemptsSection } from "./ProfessorSessionAttemptsSection";
import { SessionAttemptsBarChart } from "./charts/SessionAttemptsBarChart";
import { SessionAttemptStatusPie } from "./charts/SessionAttemptStatusPie";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { DefaultTabs } from "@/features/navigation/components/tabs";
import { Loader2, FileText } from "lucide-react";

type Props = {
  sessionId: string;
};

function SessionPageCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-6 py-5">
        <h3 className="text-base font-medium text-primary dark:text-white/90">{title}</h3>
      </div>
      <div className="border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">{children}</div>
    </div>
  );
}

export function ProfessorSessionDetail({ sessionId }: Props) {
  const { session, attempts, loading, error } = useCaseSessionDetail(sessionId);

  // F6.5: AI group debrief report
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState("");

  const handleGenerateReport = async () => {
    setReportOpen(true);
    setReportLoading(true);
    setReportError(null);
    setReportHtml("");
    try {
      const { report } = await generateSessionReport(sessionId);
      setReportHtml(report);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setReportLoading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"information" | "attempts">("information");
  const completedCount = attempts.filter((a) => a.completionStatus === "completed").length;

  if (loading) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Case Sessions", href: "/professor/sessions" },
            { label: "Session" },
          ]}
        />
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading session…
        </div>
      </>
    );
  }

  if (error || !session) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Case Sessions", href: "/professor/sessions" },
            { label: "Session not found" },
          ]}
        />
        <div className="py-12 text-center text-destructive">{error ?? "Session not found"}</div>
      </>
    );
  }

  const st = deriveStatus(session);

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Case Sessions", href: "/professor/sessions" },
          { label: session.friendlyName },
        ]}
      />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
          {session.friendlyName}
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">{session.case?.title ?? session.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Created {new Date(session.createdAt).toLocaleString()}
          {session.createdByName ? ` by ${session.createdByName}` : ""}
        </p>
      </header>

      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-background rounded-lg shadow-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">AI group debrief report</h2>
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(false)}>Close</Button>
            </div>
            {reportLoading && (
              <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Analysing {completedCount} student reports…
              </div>
            )}
            {reportError && <p className="text-sm text-destructive">{reportError}</p>}
            {!reportLoading && reportHtml && (
              <>
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: reportHtml }} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(reportHtml)}
                >
                  Copy HTML
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <DefaultTabs
        items={[
          { id: "information", label: "Session Information" },
          { id: "attempts", label: "Attempts", badge: attempts.length },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === "information" && (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <SessionInfoPanel session={session} status={st} variant="professor" />
              <SessionCasePanel
                session={session}
                href={`/case/${session.caseId}`}
                titleClassName="text-xl font-semibold text-primary"
              />
            </div>

            <SessionPageCard title="AI Group Report">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleGenerateReport} disabled={reportLoading || completedCount === 0}>
                  {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  AI group report {completedCount > 0 ? `(${completedCount} completed)` : ""}
                </Button>
                {completedCount === 0 && (
                  <p className="text-xs text-muted-foreground">Available once at least one student completes the case.</p>
                )}
              </div>
            </SessionPageCard>

            <div className="grid gap-6 md:grid-cols-2">
              <SessionPageCard title="Attempts Per Day">
                <SessionAttemptsBarChart attempts={attempts} />
              </SessionPageCard>
              <SessionPageCard title="Attempt Status">
                <SessionAttemptStatusPie attempts={attempts} />
              </SessionPageCard>
            </div>
          </div>
        )}

        {activeTab === "attempts" && <ProfessorSessionAttemptsSection session={session} attempts={attempts} />}
      </DefaultTabs>
    </div>
  );
}

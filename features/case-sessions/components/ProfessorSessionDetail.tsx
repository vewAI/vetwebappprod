"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deriveStatus } from "../models/caseSession";
import { useCaseSessionDetail } from "../hooks/useCaseSessionDetail";
import { generateSessionReport } from "../services/caseSessionService";
import { SessionCasePanel } from "./SessionCasePanel";
import { SessionInfoPanel } from "./SessionInfoPanel";
import { ProfessorSessionAttemptsSection } from "./ProfessorSessionAttemptsSection";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { Loader2, Play, FileText } from "lucide-react";

type Props = {
  sessionId: string;
};

export function ProfessorSessionDetail({ sessionId }: Props) {
  const { session, attempts, loading, error } = useCaseSessionDetail(sessionId);
  const [joinOpen, setJoinOpen] = useState(false);

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

  const completedCount = attempts.filter((a) => a.completionStatus === "completed").length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading session…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-12 text-center text-destructive">
        {error ?? "Session not found"}
      </div>
    );
  }

  const st = deriveStatus(session);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/professor/sessions">← All sessions</Link>
        </Button>
        {st === "active" && (
          <Button variant="sessions" onClick={() => setJoinOpen(true)}>
            <Play className="mr-2 h-4 w-4" />
            Start attempt (preview)
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerateReport} disabled={reportLoading || completedCount === 0}>
          {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          AI group report {completedCount > 0 ? `(${completedCount} completed)` : ""}
        </Button>
        {completedCount === 0 && (
          <p className="text-xs text-muted-foreground">Available once at least one student completes the case.</p>
        )}
      </div>

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

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <SessionCasePanel session={session} />
        <SessionInfoPanel session={session} status={st} variant="professor" />
      </div>

      <ProfessorSessionAttemptsSection attempts={attempts} />

      <JoinSessionDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        session={session}
        caseId={session.caseId}
      />
    </div>
  );
}

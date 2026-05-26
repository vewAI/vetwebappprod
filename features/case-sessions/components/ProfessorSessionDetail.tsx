"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deriveStatus } from "../models/caseSession";
import { useCaseSessionDetail } from "../hooks/useCaseSessionDetail";
import { SessionCasePanel } from "./SessionCasePanel";
import { SessionInfoPanel } from "./SessionInfoPanel";
import { ProfessorSessionAttemptsSection } from "./ProfessorSessionAttemptsSection";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { Loader2, Play } from "lucide-react";

type Props = {
  sessionId: string;
};

export function ProfessorSessionDetail({ sessionId }: Props) {
  const { session, attempts, loading, error } = useCaseSessionDetail(sessionId);
  const [joinOpen, setJoinOpen] = useState(false);

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

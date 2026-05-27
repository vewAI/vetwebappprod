"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deriveStatus } from "../models/caseSession";
import { useCaseSessionDetail } from "../hooks/useCaseSessionDetail";
import { SessionCasePanel } from "./SessionCasePanel";
import { SessionInfoPanel } from "./SessionInfoPanel";
import { MySessionAttemptsList } from "./MySessionAttemptsList";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { ChevronRight, Loader2 } from "lucide-react";

type Props = {
  sessionId: string;
};

export function StudentSessionDetail({ sessionId }: Props) {
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
      <Button variant="ghost" size="sm" asChild>
        <Link href="/case-sessions">← All sessions</Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <SessionCasePanel session={session} />
        <SessionInfoPanel session={session} status={st} variant="student" />
      </div>

      <MySessionAttemptsList attempts={attempts} />

      {st === "active" && (
        <div className="flex justify-end">
          <Button variant="sessions" onClick={() => setJoinOpen(true)}>
            Start Case
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      <JoinSessionDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        session={session}
        caseId={session.caseId}
      />
    </div>
  );
}

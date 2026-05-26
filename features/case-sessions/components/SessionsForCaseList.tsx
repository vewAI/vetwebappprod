"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSessions } from "../services/caseSessionService";
import type { CaseSession } from "../models/caseSession";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { CaseSessionCard } from "./case-session-card";
import { ChevronRight, Loader2, Calendar } from "lucide-react";

type Props = {
  caseId: string;
  variant: "student" | "professor";
};

export function SessionsForCaseList({ caseId, variant }: Props) {
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinSession, setJoinSession] = useState<CaseSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({
          caseId,
          status: variant === "student" ? "active" : "all",
        });
        if (!cancelled) setSessions(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId, variant]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading sessions…
      </div>
    );
  }

  if (variant === "professor") {
    const recent = sessions.slice(0, 3);
    const viewAllHref = `/case-sessions?caseId=${encodeURIComponent(caseId)}`;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sessions.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={viewAllHref}>View all</Link>
            </Button>
          )}
          <Button variant="sessions" size="sm" asChild>
            <Link href={`/professor/sessions/new?caseId=${encodeURIComponent(caseId)}`}>
              Create session
            </Link>
          </Button>
        </div>

        {recent.length === 0 ? (
          <Card>
            <CardContent className="py-8 space-y-4">
              <p className="text-muted-foreground">
                No sessions for this case yet. Create one to let students join during class.
              </p>
              <Button variant="sessions" size="sm" asChild>
                <Link href={`/professor/sessions/new?caseId=${encodeURIComponent(caseId)}`}>
                  Create session
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((session) => (
                <CaseSessionCard key={session.id} session={session} variant="professor" />
              ))}
            </div>
            {sessions.length > 3 && (
              <div className="text-center">
                <Link href={viewAllHref} className="text-sm font-medium text-sessions hover:underline">
                  View all {sessions.length} sessions
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-muted-foreground">
            No active sessions for this case right now. Check back when your instructor opens a
            session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-4"
        >
          <div>
            <div className="font-semibold">{s.friendlyName}</div>
            <div className="text-sm text-muted-foreground">{s.description}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(s.startAt).toLocaleString()} — {new Date(s.endAt).toLocaleString()}
              {s.attemptLimitPerStudent != null && (
                <span className="ml-2">· Max {s.attemptLimitPerStudent} attempt(s)/student</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" asChild>
              <Link href={`/case-sessions/${s.id}`}>
                View details
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="sessions" onClick={() => setJoinSession(s)}>
              Start Case
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {joinSession && (
        <JoinSessionDialog
          open={Boolean(joinSession)}
          onOpenChange={(open) => !open && setJoinSession(null)}
          session={joinSession}
          caseId={caseId}
        />
      )}
    </div>
  );
}

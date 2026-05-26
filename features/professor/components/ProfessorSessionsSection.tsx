"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseSessionCard } from "@/features/case-sessions/components/case-session-card";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";

type Props = {
  refreshKey?: number;
};

export function ProfessorSessionsSection({ refreshKey }: Props) {
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({ mine: true, status: "all" });
        if (!cancelled) setSessions(list);
      } catch (e) {
        console.error("Failed to load professor sessions", e);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Sessions</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/professor/sessions">Manage all sessions</Link>
          </Button>
          <Button variant="sessions" size="sm" asChild>
            <Link href="/professor/sessions/new">Create session</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden pt-0">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            You have not created any case sessions yet.{" "}
            <Link
              href="/professor/sessions/new"
              className="font-medium text-sessions underline-offset-4 hover:underline"
            >
              Create your first session
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.slice(0, 3).map((session) => (
            <CaseSessionCard
              key={session.id}
              session={session}
              variant="professor"
            />
          ))}
        </div>
      )}
    </div>
  );
}

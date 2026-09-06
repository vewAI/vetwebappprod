"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CaseSessionCard } from "@/features/case-sessions/components/case-session-card";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";

const SESSIONS_HELP = [
  {
    title: "What is a session?",
    body: "A session is a time-boxed assignment of ONE clinical case to a group of students. You choose the case, the time window when it is available, an optional access code, and how many attempts each student gets.",
  },
  {
    title: "How students use it",
    body: "Share the access code (and the time window). Students open the 'Sessions' page in their menu, enter the code, and run the case — by voice (Live) or by written chat. Every attempt is automatically linked to the session.",
  },
  {
    title: "Tracking progress",
    body: "Open a session to see per-student status (not started / in progress / completed), time invested, and charts. Each attempt links to the full transcript and AI feedback.",
  },
  {
    title: "AI group debrief",
    body: "Once at least one student has completed the case, the 'AI group report' button produces a class-wide debrief: common strengths, ranked weak points, performance per learning objective (if defined on the case), and recommended wrap-up topics.",
  },
];

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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">How sessions work</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Sessions — quick guide</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {SESSIONS_HELP.map((section, i) => (
                  <div key={section.title}>
                    <p className="text-sm font-semibold">
                      {i + 1}. {section.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
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

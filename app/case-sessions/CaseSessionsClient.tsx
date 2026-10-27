"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CaseSessionCard } from "@/features/case-sessions/components/case-session-card";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";
import { fetchCaseById } from "@/features/case-selection/services/caseService";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";
import { useAuth } from "@/features/auth/services/authService";
import { YearGroupRequiredAlert } from "@/features/year-groups/components/YearGroupRequiredAlert";

export default function CaseSessionsClient() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId")?.trim() || undefined;
  const { role, yearGroupId, profileLoading } = useAuth();
  const needsYearGroup = role === "student" && !yearGroupId;

  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [caseTitle, setCaseTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) {
      setCaseTitle(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const c = await fetchCaseById(caseId);
      if (!cancelled) setCaseTitle(c?.title ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    if (profileLoading) return;
    if (needsYearGroup) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({
          caseId,
          status: "active",
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
  }, [caseId, needsYearGroup, profileLoading]);

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb
        items={
          caseId
            ? [
                { label: "Home", href: "/dashboard" },
                { label: "Start", href: "/case-sessions" },
                { label: caseTitle ?? "Case Sessions" },
              ]
            : [{ label: "Home", href: "/dashboard" }, { label: "Start" }]
        }
      />
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Start</h1>
        <p className="mt-4 text-xl text-muted-foreground">Join a session from your instructor to attempt a case.</p>
        {caseId ? (
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href={`/case/${caseId}/instructions`}>View case</Link>
            </Button>
          </div>
        ) : null}

        <div
          role="note"
          className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-start text-sm leading-relaxed text-muted-foreground"
        >
          <p>
            <strong className="text-primary">What is a session?</strong> Your instructor assigns one clinical case to the
            class during a specific time window. Open a session below, enter the access code your instructor gave you, and
            complete the case by voice or by chat — every attempt counts towards the session automatically.
          </p>
          <p className="mt-2">
            You can track your attempt from the session page, and your instructor sees the same progress and feedback to
            prepare the class debrief.
          </p>
        </div>
      </header>

      <YearGroupRequiredAlert className="mb-8" />

      {profileLoading || (loading && !needsYearGroup) ? (
        <div className="p-8 text-center text-muted-foreground">Loading active sessions…</div>
      ) : needsYearGroup ? null : sessions.length === 0 ? (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            {caseId
              ? "No active sessions for this case right now."
              : "No active sessions right now. Check back when your instructor opens a session."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-in motion-safe:fade-in-50">
          {sessions.map((session) => (
            <CaseSessionCard key={session.id} session={session} variant="student" />
          ))}
        </div>
      )}
    </div>
  );
}

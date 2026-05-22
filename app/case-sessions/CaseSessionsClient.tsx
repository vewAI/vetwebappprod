"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CaseSessionCard } from "@/features/case-sessions/components/case-session-card";
import { listSessions } from "@/features/case-sessions/services/caseSessionService";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";
import { useAuth } from "@/features/auth/services/authService";
import { fetchCaseById } from "@/features/case-selection/services/caseService";

export default function CaseSessionsClient() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId")?.trim() || undefined;
  const { role } = useAuth();
  const isStaff = role === "professor" || role === "admin";
  const showAllStatuses = Boolean(caseId && isStaff);

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
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({
          caseId,
          status: showAllStatuses ? "all" : "active",
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
  }, [caseId, showAllStatuses]);

  const backHref = caseId ? `/case/${caseId}/instructions` : "/";
  const backLabel = caseId ? "Back to case instructions" : "Back to home";

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-sessions md:text-4xl">
              {showAllStatuses ? (caseTitle ? `Sessions — ${caseTitle}` : "Case Sessions") : "Active Case Sessions"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {showAllStatuses
                ? "All sessions for this case, including scheduled and completed."
                : "Join a session from your instructor to attempt a case."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showAllStatuses && caseId && (
              <Button variant="sessions" size="sm" asChild>
                <Link href={`/professor/sessions/new?caseId=${encodeURIComponent(caseId)}`}>Create session</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">{showAllStatuses ? "Loading sessions…" : "Loading active sessions…"}</div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            {showAllStatuses
              ? "No sessions for this case yet."
              : caseId
                ? "No active sessions for this case right now."
                : "No active sessions right now. Check back when your instructor opens a session, or browse cases to practice on your own."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 motion-safe:animate-in motion-safe:fade-in-50">
          {sessions.map((session) => (
            <CaseSessionCard key={session.id} session={session} variant={isStaff ? "professor" : "student"} />
          ))}
        </div>
      )}
    </div>
  );
}

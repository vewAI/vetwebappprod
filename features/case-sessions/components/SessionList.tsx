"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { listSessions } from "../services/caseSessionService";
import type { CaseSession } from "../models/caseSession";
import { deriveStatus } from "../models/caseSession";
import { JoinSessionDialog } from "./JoinSessionDialog";
import { fetchCases } from "@/features/case-selection/services/caseService";
import type { Case } from "@/features/case-selection/models/case";
import { Loader2, Play } from "lucide-react";

export function SessionList() {
  const [status, setStatus] = useState<
    "all" | "scheduled" | "active" | "completed"
  >("all");
  const [q, setQ] = useState("");
  const [caseFilterId, setCaseFilterId] = useState("");
  const [cases, setCases] = useState<Case[]>([]);
  const [sessions, setSessions] = useState<CaseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinSession, setJoinSession] = useState<CaseSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCases({ limit: 200 });
        if (!cancelled) setCases(list);
      } catch {
        if (!cancelled) setCases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listSessions({
          status,
          caseId: caseFilterId || undefined,
          q: q.trim() || undefined,
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
  }, [status, caseFilterId, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[140px]"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as typeof status)
            }
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-sm font-medium">Case</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={caseFilterId}
            onChange={(e) => setCaseFilterId(e.target.value)}
          >
            <option value="">All cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-sm font-medium">Search</label>
          <Input
            placeholder="Session or case title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground py-8">No sessions match your filters.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const st = deriveStatus(s);
            return (
              <li key={s.id}>
                <Card>
                  <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{s.friendlyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.name} · Case: {s.case?.title ?? s.caseId}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(s.startAt).toLocaleString()} —{" "}
                        {new Date(s.endAt).toLocaleString()}
                      </div>
                      <span
                        className={`inline-block mt-2 text-xs px-2 py-0.5 rounded border ${
                          st === "active"
                            ? "border-green-600 text-green-700 bg-green-50 dark:bg-green-950"
                            : st === "scheduled"
                              ? "border-amber-600 text-amber-800 bg-amber-50 dark:bg-amber-950"
                              : "border-muted-foreground/40 text-muted-foreground"
                        }`}
                      >
                        {st}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="sessions-outline" size="sm" asChild>
                        <Link href={`/professor/sessions/${s.id}`}>Details</Link>
                      </Button>
                      {st === "active" && (
                        <Button
                          variant="sessions"
                          size="sm"
                          onClick={() => setJoinSession(s)}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Start attempt
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {joinSession && (
        <JoinSessionDialog
          open={Boolean(joinSession)}
          onOpenChange={(open) => !open && setJoinSession(null)}
          session={joinSession}
          caseId={joinSession.caseId}
        />
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseSession, SessionStatus } from "../models/caseSession";
import { useCountdown } from "../hooks/useCountdown";
import { Play } from "lucide-react";

type Props = {
  session: CaseSession;
  status: SessionStatus;
  canStart: boolean;
  remainingAttempts: number | null;
  onStart: () => void;
};

function formatWindowDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StartSessionCard({ session, status, canStart, remainingAttempts, onStart }: Props) {
  const countdown = useCountdown(session.endAt);

  const startLabel =
    status === "scheduled"
      ? `Opens ${formatWindowDate(session.startAt)}`
      : status === "completed" || countdown.expired
        ? "Session closed"
        : remainingAttempts === 0
          ? "No attempts remaining"
          : "Start";

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Start</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Year group</p>
            <p className="mt-1 text-base font-semibold">{session.yearGroupName ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Opens</p>
            <p className="mt-1 text-base font-semibold">{formatWindowDate(session.startAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Closes</p>
            <p className="mt-1 text-base font-semibold">{formatWindowDate(session.endAt)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-primary/5 px-4 py-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {countdown.expired ? "Session closed" : "Time left before this session closes"}
          </p>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight text-primary md:text-5xl">
            {countdown.expired ? "0:00:00" : countdown.label}
          </p>
        </div>

        <Button
          className="h-12 w-full bg-brand-100 text-base font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-500/12 dark:text-brand-400 dark:hover:bg-brand-500/20"
          disabled={!canStart}
          onClick={onStart}
        >
          <Play className="mr-2 h-5 w-5" />
          {startLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

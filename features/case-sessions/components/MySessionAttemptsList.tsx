"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionAttemptRow } from "../models/caseSession";

type Props = {
  attempts: SessionAttemptRow[];
  attemptLimit: number | null;
};

function statusLabel(status: SessionAttemptRow["completionStatus"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Abandoned";
}

function formatTimeSpent(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  return `${Math.floor(seconds / 60)} min`;
}

export function MySessionAttemptsList({ attempts, attemptLimit }: Props) {
  const unlimited = attemptLimit == null || attemptLimit <= 0;
  const remaining = unlimited ? null : Math.max(0, attemptLimit - attempts.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Your Attempts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg bg-muted/50 p-4 text-center sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Attempt limit</p>
            <p className="mt-1 text-2xl font-bold text-primary">{unlimited ? "Unlimited" : attemptLimit}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Used</p>
            <p className="mt-1 text-2xl font-bold">{attempts.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
            <p className="mt-1 text-2xl font-bold text-primary">{unlimited ? "Unlimited" : remaining}</p>
          </div>
        </div>

        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have not started an attempt in this session yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b border-muted">
                    <td className="py-2 pr-4">
                      <Badge
                        variant={
                          attempt.completionStatus === "completed"
                            ? "success"
                            : attempt.completionStatus === "in_progress"
                              ? "warning"
                              : "destructive"
                        }
                        className={attempt.completionStatus === "abandoned" ? "text-white" : undefined}
                      >
                        {statusLabel(attempt.completionStatus)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{formatTimeSpent(attempt.timeSpentSeconds)}</td>
                    <td className="py-2 pr-4">{new Date(attempt.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link href={`/attempts/${attempt.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

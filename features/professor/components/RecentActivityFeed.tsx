"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, UserPlus } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";

type CompletionEvent = {
  attemptId: string;
  studentId: string;
  studentName: string;
  caseTitle: string;
  date: string;
};

type EnrollmentEvent = {
  studentId: string;
  studentName: string;
  date: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function RecentActivityFeed() {
  const { session } = useAuth();
  const [completions, setCompletions] = useState<CompletionEvent[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const resp = await axios.get("/api/professor/recent-activity", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setCompletions(resp.data.completions);
        setEnrollments(resp.data.enrollments);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.access_token]);

  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (completions.length === 0 && enrollments.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        </CardContent>
      </Card>
    );
  }

  // Merge and sort by date
  const events = [
    ...completions.map((c) => ({ ...c, type: "completion" as const })),
    ...enrollments.map((e) => ({ ...e, type: "enrollment" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.slice(0, 10).map((ev, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              {ev.type === "completion" ? (
                <CheckCircle2 className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
              ) : (
                <UserPlus className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="truncate">
                  {ev.type === "completion"
                    ? `${ev.studentName} completed "${ev.caseTitle}"`
                    : `${ev.studentName} enrolled`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {relativeTime(ev.date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

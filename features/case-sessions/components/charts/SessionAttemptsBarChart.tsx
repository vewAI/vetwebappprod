"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SessionAttemptRow } from "../../models/caseSession";

type Props = {
  attempts: SessionAttemptRow[];
};

export function SessionAttemptsBarChart({ attempts }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attempts) {
      const key = a.createdAt.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date,
        attempts: count,
      }));
  }, [attempts]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No attempts yet for this session.
      </p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="attempts" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Attempts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

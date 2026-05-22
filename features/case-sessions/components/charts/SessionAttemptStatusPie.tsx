"use client";

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SessionAttemptRow } from "../../models/caseSession";

const COLORS: Record<string, string> = {
  in_progress: "#0ea5e9",
  completed: "#14b8a6",
  abandoned: "#94a3b8",
};

type Props = {
  attempts: SessionAttemptRow[];
};

export function SessionAttemptStatusPie({ attempts }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attempts) {
      const k = a.completionStatus;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: name.replace("_", " "),
      value,
      key: name,
    }));
  }, [attempts]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No attempts to chart.
      </p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={COLORS[entry.key] ?? "#cbd5e1"}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

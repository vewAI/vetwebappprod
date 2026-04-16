"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type CaseStat = {
  caseTitle: string;
  studentsCompleted: number;
  studentsAssigned: number;
};

type Props = {
  data: CaseStat[];
};

export function CompletionByCaseChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No cases assigned to this course yet.
      </p>
    );
  }

  const chartData = data.map((d) => ({
    name: d.caseTitle.length > 25 ? d.caseTitle.slice(0, 25) + "..." : d.caseTitle,
    Completed: d.studentsCompleted,
    Remaining: d.studentsAssigned - d.studentsCompleted,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Completed" stackId="a" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Remaining" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CompletionByCaseChart;

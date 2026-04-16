"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  totalStudents: number;
  studentsWithCompleted: number;
  completionRate: number;
  avgTimeSeconds: number;
  totalAttempts: number;
  completedAttempts: number;
};

export function CourseStatsCards({
  totalStudents,
  studentsWithCompleted,
  completionRate,
  avgTimeSeconds,
  totalAttempts,
  completedAttempts,
}: Props) {
  const cards = [
    {
      label: "Total Students",
      value: totalStudents,
      color: "border-l-blue-500",
    },
    {
      label: "Active Students",
      value: `${studentsWithCompleted} / ${totalStudents}`,
      sub: `${completionRate}% have completed at least one case`,
      color: "border-l-emerald-500",
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      sub: `${completedAttempts} of ${totalAttempts} attempts completed`,
      color: "border-l-teal-500",
    },
    {
      label: "Avg. Time",
      value: avgTimeSeconds > 0 ? `${Math.round(avgTimeSeconds / 60)} min` : "—",
      color: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className={`border-l-4 ${c.color}`}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {c.label}
            </p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
            {c.sub && (
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default CourseStatsCards;

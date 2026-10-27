"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttemptDayCount } from "../../models/dashboard";

export function AttemptsPerDayChart({ data }: { data: AttemptDayCount[] }) {
  const hasAttempts = data.some((point) => point.attempts > 0);
  if (!hasAttempts) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No attempts in the last 30 days.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(value: string) => {
              const date = new Date(`${value}T00:00:00Z`);
              return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
            }}
            interval={4}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(value) =>
              new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })
            }
          />
          <Bar dataKey="attempts" fill="#059669" radius={[4, 4, 0, 0]} name="Attempts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

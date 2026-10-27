"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttemptMonthCount } from "../../models/dashboard";

export function AttemptsPerMonthChart({ data }: { data: AttemptMonthCount[] }) {
  const hasAttempts = data.some((point) => point.attempts > 0);
  if (!hasAttempts) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No attempts in the last 12 months.</p>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="attempts" fill="#059669" radius={[4, 4, 0, 0]} name="Attempts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { AttemptMonthCount } from "../../models/dashboard";

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{String(label)}</p>
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{payload[0].value} attempts</p>
    </div>
  );
}

export function AttemptsPerMonthChart({ data }: { data: AttemptMonthCount[] }) {
  const hasAttempts = data.some((point) => point.attempts > 0);
  if (!hasAttempts) {
    return <p className="py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">No attempts in the last 12 months.</p>;
  }

  return (
    <div className="h-[330px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%" margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#E4E7EC" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#667085" }} interval={0} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#667085" }} width={36} />
          <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(5, 150, 105, 0.08)" }} />
          <Bar dataKey="attempts" fill="#059669" radius={[5, 5, 0, 0]} maxBarSize={28} name="Attempts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

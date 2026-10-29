"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import { Dropdown } from "@/features/navigation/components/dropdown";
import { DropdownItem } from "@/features/navigation/components/dropdown-item";
import { MoreDotIcon } from "@/features/navigation/icons";
import { cn } from "@/lib/utils";
import {
  buildCaseTimeSpentStats,
  formatCompactDuration,
  type TimePeriod,
} from "../lib/caseTimeSpentStats";

type Props = {
  attempts: AttemptSummary[];
  loading?: boolean;
  academicYearEnd: { month: number; day: number };
};

function formatPointLabel(value: string, granularity: "week" | "month") {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: granularity === "month" ? undefined : "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  granularity,
}: TooltipContentProps & { granularity: "week" | "month" }) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{formatPointLabel(label, granularity)}</p>
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{payload[0].value} attempts</p>
    </div>
  );
}

export function CaseTimeSpentChart({ attempts, loading = false, academicYearEnd }: Props) {
  const [period, setPeriod] = useState<TimePeriod>("current");
  const [menuOpen, setMenuOpen] = useState(false);
  const stats = useMemo(
    () => buildCaseTimeSpentStats({ attempts, period, academicYearEnd }),
    [attempts, period, academicYearEnd],
  );
  const hasAttempts = stats.points.some((point) => point.attempts > 0);

  const selectPeriod = (next: TimePeriod) => {
    setPeriod(next);
    setMenuOpen(false);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Total Time Spent</h3>
        <div className="relative inline-block">
          <button
            type="button"
            className="dropdown-toggle"
            aria-label="Select time period"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreDotIcon className="size-6 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
          <Dropdown isOpen={menuOpen} onClose={() => setMenuOpen(false)} className="w-44 p-2">
            <DropdownItem
              className={cn(period === "current" && "font-medium text-brand-700 dark:text-brand-400")}
              onClick={() => selectPeriod("current")}
            >
              This academic year
            </DropdownItem>
            <DropdownItem
              className={cn(period === "anytime" && "font-medium text-brand-700 dark:text-brand-400")}
              onClick={() => selectPeriod("anytime")}
            >
              All time
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-1.5">
        <span className="text-2xl font-semibold text-gray-800 dark:text-white/90">
          {loading ? "—" : formatCompactDuration(stats.totalSeconds)}
        </span>
        <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">{stats.periodLabel}</span>
      </div>

      <div className="my-5 min-h-[155px] flex-1 rounded-xl bg-gray-50 dark:bg-gray-900">
        {loading ? (
          <p className="flex h-[155px] items-center justify-center text-theme-sm text-gray-500 dark:text-gray-400">
            Loading chart...
          </p>
        ) : !hasAttempts ? (
          <p className="flex h-[155px] items-center justify-center text-theme-sm text-gray-500 dark:text-gray-400">
            No attempts in this period.
          </p>
        ) : (
          <div className="-ms-2 -me-1 h-[155px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.points} margin={{ top: 12, right: 8, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="caseTimeSpentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={(props) => <ChartTooltip {...props} granularity={stats.granularity} />} />
                <Area
                  type="monotone"
                  dataKey="attempts"
                  name="Attempts"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#caseTimeSpentFill)"
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        {[
          { label: "Avg, Daily", value: stats.avgDailySeconds },
          { label: "Avg, Weekly", value: stats.avgWeeklySeconds },
          { label: "Avg, Monthly", value: stats.avgMonthlySeconds },
        ].map((item) => (
          <div key={item.label} className="min-w-0 flex-1 text-center">
            <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {loading ? "—" : formatCompactDuration(item.value)}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

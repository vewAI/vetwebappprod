"use client";

import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AttemptSummary } from "@/features/attempts/models/attempt";
import type { CaseSession } from "@/features/case-sessions/models/caseSession";
import { Dropdown } from "@/features/navigation/components/dropdown";
import { DropdownItem } from "@/features/navigation/components/dropdown-item";
import { MoreDotIcon } from "@/features/navigation/icons";
import { cn } from "@/lib/utils";
import { attemptsBySessionYearGroup } from "../lib/attemptsByYearGroup";
import type { TimePeriod } from "../lib/caseTimeSpentStats";

const COLORS = ["#047857", "#059669", "#10b981", "#6ee7b7", "#a7f3d0", "#d1fae5", "#94a3b8"];

type Props = {
  attempts: AttemptSummary[];
  sessions: CaseSession[];
  loading?: boolean;
  academicYearEnd: { month: number; day: number };
};

export function AttemptsByYearGroupChart({
  attempts,
  sessions,
  loading = false,
  academicYearEnd,
}: Props) {
  const [period, setPeriod] = useState<TimePeriod>("current");
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionsById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );
  const data = useMemo(
    () => attemptsBySessionYearGroup({ attempts, sessionsById, period, academicYearEnd }),
    [attempts, sessionsById, period, academicYearEnd],
  );
  const hasAttempts = data.some((row) => row.count > 0);

  const selectPeriod = (next: TimePeriod) => {
    setPeriod(next);
    setMenuOpen(false);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-9 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Attempts by year group</h3>
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
      {loading ? (
        <p className="py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">Loading chart...</p>
      ) : !hasAttempts ? (
        <p className="py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">
          No attempts in this period.
        </p>
      ) : (
        <div className="mx-auto flex h-[290px] w-full justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="46%"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={0}
                stroke="#fff"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} attempts`, String(name)]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-theme-sm text-gray-600 dark:text-gray-400">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

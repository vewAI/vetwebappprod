"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RankedCount } from "../../models/dashboard";

const COLORS = ["#059669", "#0d9488", "#10b981", "#34d399", "#2dd4bf", "#14b8a6", "#5eead4", "#94a3b8"];

export function StudentsByYearGroupChart({ data }: { data: RankedCount[] }) {
  const hasStudents = data.some((row) => row.count > 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-9">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Students by year group</h3>
      </div>
      {!hasStudents ? (
        <p className="py-12 text-center text-theme-sm text-gray-500 dark:text-gray-400">No students to chart.</p>
      ) : (
        <div className="mx-auto h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}`, String(name)]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-theme-sm text-gray-600 dark:text-gray-400">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

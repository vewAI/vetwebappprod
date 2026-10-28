"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { RankedCount } from "../models/dashboard";

const ACTION_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white p-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]";

export function RankingCard({
  title,
  subtitle,
  sourceLabel,
  valueLabel,
  rows,
  emptyMessage,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle?: string;
  sourceLabel: string;
  valueLabel: string;
  rows: RankedCount[];
  emptyMessage: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        {subtitle ? (
          <span className="mt-1 block text-theme-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
        ) : null}
      </div>
      <div className="my-6 flex-1">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
          <span className="text-theme-xs text-gray-400">{sourceLabel}</span>
          <span className="text-end text-theme-xs text-gray-400">{valueLabel}</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-theme-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-6 border-b border-gray-100 py-3 dark:border-gray-800"
            >
              {row.href ? (
                <Link
                  href={row.href}
                  className="min-w-0 max-w-[68%] truncate text-theme-sm font-medium text-gray-700 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
                  title={row.name}
                >
                  {row.name}
                </Link>
              ) : (
                <span
                  className="min-w-0 max-w-[68%] truncate text-theme-sm text-gray-500 dark:text-gray-400"
                  title={row.name}
                >
                  {row.name}
                </span>
              )}
              <span className="shrink-0 text-end text-theme-sm text-gray-500 dark:text-gray-400">{row.count}</span>
            </div>
          ))
        )}
      </div>
      <Link href={actionHref} className={`${ACTION_CLASS} mt-auto`}>
        {actionLabel}
        <ChevronRight className="size-5 rtl:rotate-180" />
      </Link>
    </div>
  );
}

/**
 * Adapted from TailAdmin React Tab with badge (MIT).
 * https://react-demo.tailadmin.com/tabs
 */
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  badge?: number | string;
};

export function DefaultTabs<T extends string>({
  items,
  value,
  onChange,
  children,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-2 overflow-x-auto" role="tablist">
          {items.map((item) => {
            const isActive = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-in-out",
                  isActive
                    ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400"
                    : "border-transparent bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                )}
                onClick={() => onChange(item.id)}
              >
                {item.label}
                {item.badge != null ? (
                  <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-center text-xs font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="pt-8" role="tabpanel">
        {children}
      </div>
    </div>
  );
}

"use client";

/**
 * Adapted from TailAdmin React PageBreadCrumb (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import Link from "next/link";
import type { BreadcrumbItem } from "@/features/navigation/models/breadcrumb";
import { cn } from "@/lib/utils";

export type { BreadcrumbItem };

function Chevron() {
  return (
    <svg className="stroke-current" width="17" height="16" viewBox="0 0 17 16" fill="none" aria-hidden="true">
      <path d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-6", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  {item.label}
                  <Chevron />
                </Link>
              ) : (
                <span className="text-sm text-gray-800 dark:text-white/90" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

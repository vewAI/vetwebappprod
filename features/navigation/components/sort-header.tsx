import { TableCell } from "@/features/navigation/components/table";
import type { TableSort } from "@/features/navigation/models/table-sort";
import { cn } from "@/lib/utils";

export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: K;
  sort: TableSort<K>;
  onSort: (key: K) => void;
}) {
  const active = sort.key === column;
  return (
    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-white/90"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className={cn(active ? "text-brand-500" : "text-gray-300 dark:text-gray-600")}
        >
          {active && sort.dir === "desc" ? (
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M5 12.5L10 7.5L15 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </TableCell>
  );
}

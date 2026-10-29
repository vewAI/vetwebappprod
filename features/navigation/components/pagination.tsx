/**
 * Adapted from TailAdmin React Pagination with Text (MIT).
 * https://react-demo.tailadmin.com/pagination
 */
import { cn } from "@/lib/utils";

export function paginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }
  if (page >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

const pageButtonClass =
  "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-500 hover:text-white dark:text-gray-400 dark:hover:text-white";
const pageButtonActiveClass =
  "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600";
const navButtonClass =
  "flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:py-2.5 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200";

function ChevronLeft() {
  return (
    <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.58203 9.99868C2.58174 10.1909 2.6549 10.3833 2.80152 10.53L7.79818 15.5301C8.09097 15.8231 8.56584 15.8233 8.85883 15.5305C9.15183 15.2377 9.152 14.7629 8.85921 14.4699L5.13911 10.7472L16.6665 10.7472C17.0807 10.7472 17.4165 10.4114 17.4165 9.99715C17.4165 9.58294 17.0807 9.24715 16.6665 9.24715L5.14456 9.24715L8.85919 5.53016C9.15199 5.23717 9.15184 4.7623 8.85885 4.4695C8.56587 4.1767 8.09099 4.17685 7.79819 4.46984L2.84069 9.43049C2.68224 9.568 2.58203 9.77087 2.58203 9.99715C2.58203 9.99766 2.58203 9.99817 2.58203 9.99868Z"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.4165 9.9986C17.4168 10.1909 17.3437 10.3832 17.197 10.53L12.2004 15.5301C11.9076 15.8231 11.4327 15.8233 11.1397 15.5305C10.8467 15.2377 10.8465 14.7629 11.1393 14.4699L14.8594 10.7472L3.33203 10.7472C2.91782 10.7472 2.58203 10.4114 2.58203 9.99715C2.58203 9.58294 2.91782 9.24715 3.33203 9.24715L14.854 9.24715L11.1393 5.53016C10.8465 5.23717 10.8467 4.7623 11.1397 4.4695C11.4327 4.1767 11.9075 4.17685 12.2003 4.46984L17.1578 9.43049C17.3163 9.568 17.4165 9.77087 17.4165 9.99715C17.4165 9.99763 17.4165 9.99812 17.4165 9.9986Z"
      />
    </svg>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const items = paginationItems(page, totalPages);

  return (
    <nav className={cn("flex items-center justify-between gap-8 px-6 py-4 sm:justify-normal", className)} aria-label="Pagination">
      <button
        type="button"
        className={navButtonClass}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span className="inline sm:hidden">
          <ChevronLeft />
        </span>
        <span className="hidden sm:inline">Previous</span>
      </button>
      <span className="block text-sm font-medium text-gray-700 sm:hidden dark:text-gray-400">
        Page {page} of {totalPages}
      </span>
      <ul className="hidden items-center gap-0.5 sm:flex">
        {items.map((item, index) =>
          item === "ellipsis" ? (
            <li key={`ellipsis-${index}`}>
              <span className="flex h-10 w-10 items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-400">
                ...
              </span>
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={item === page ? pageButtonActiveClass : pageButtonClass}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        className={navButtonClass}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <span className="hidden sm:inline">Next</span>
        <span className="inline sm:hidden">
          <ChevronRight />
        </span>
      </button>
    </nav>
  );
}

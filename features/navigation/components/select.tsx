/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

export function Select({
  options,
  value,
  onChange,
  className,
  selectClassName,
  id,
  disabled = false,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800",
          disabled && "cursor-not-allowed bg-gray-100 text-gray-500 opacity-40 dark:bg-gray-800 dark:text-gray-400",
          selectClassName,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 dark:text-gray-400">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4.79175 7.39584L10.0001 12.6042L15.2084 7.39585"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
